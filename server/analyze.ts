import type { ChatEvent, ContributorStats, FollowupQuestion, StackGroup } from '../shared/types.ts'
import { parseRepoUrl } from '../shared/repo.ts'
import { TtlCache } from './cache.ts'
import { aiEnabled, analyzeContributor, narrateOrNull, summarizeRepo } from './gemini.ts'
import { env } from './env.ts'
import { createGitHub, GitHubError, mapLimit, type CommitDetail, type GitHub, type Pull, type Repo } from './github.ts'
import {
  fromCommits,
  fromStatsApi,
  isExcludedFile,
  isMergeCommit,
  MAX_COMMITS,
  mergeMisattributed,
  rank,
  type Collected,
} from './stats.ts'
import { answerFollowup, followupEvent, personId } from './insights.ts'
import { formatNumber, sanitize, truncate } from './text.ts'

/** 역할과 코드 스타일까지 자세히 소개하는 최대 인원 */
const MAX_DETAILED = 10
/** 마지막 요약 그래프에 그리는 최대 인원 */
const MAX_CHART = 15
const AI_CONCURRENCY = 2

// Gemini에 보내는 자료 길이 제한 (비용 절감)
const README_LIMIT = 6000
const TREE_LIMIT = 150
const SAMPLE_COMMITS = 5
const FILE_PATCH_LIMIT = 1500
const COMMIT_DIFF_LIMIT = 3500
const CONTRIBUTOR_DIFF_LIMIT = 9000
const COMMIT_MESSAGE_LIMIT = 50
const PULL_TITLE_LIMIT = 10

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const resultCache = new TtlCache<ChatEvent[]>(CACHE_TTL_MS, 300)
const summaryCache = new TtlCache<RepoIntro>(CACHE_TTL_MS, 300)

type Emit = (event: ChatEvent) => void

type Ranked = ContributorStats & { key: string }

function rateLimitMessage(err: GitHubError): string {
  if (!err.resetAt) return 'GitHub API 호출 제한을 넘었어요. 잠시 뒤에 다시 시도해 주세요.'
  const minutes = Math.max(1, Math.ceil((err.resetAt - Date.now()) / 60000))
  return `GitHub API 호출 제한을 넘었어요. 약 ${minutes}분 뒤에 다시 시도해 주세요.`
}

function repoErrorEvent(err: unknown): ChatEvent {
  if (err instanceof GitHubError) {
    if (err.rateLimited) return { type: 'error', text: rateLimitMessage(err), action: 'retry' }
    if (err.status === 404) {
      // 비공개 레포도 GitHub가 404로 알려줘서, 없는 레포와 구분할 수 없어요.
      return {
        type: 'error',
        text: '레포를 찾을 수 없어요. 주소가 틀렸거나 **비공개 레포**일 수 있어요. 비공개 레포는 분석할 수 없어요.',
      }
    }
    if (err.status === 401) {
      return { type: 'error', text: '서버의 GitHub 토큰에 문제가 있어요. 관리자에게 알려주세요.' }
    }
    if (err.status === 403) {
      // 조직이 만료 기간이 긴 fine-grained 토큰을 막아 둔 경우예요. 공개 레포여도 403이 와요.
      if (/token's lifetime/i.test(err.detail)) {
        return {
          type: 'error',
          text: '이 레포의 조직은 만료 기간이 366일을 넘는 GitHub 토큰의 접근을 막고 있어요. 서버의 GITHUB_TOKEN 만료 기간을 366일 이하로 바꾸면 분석할 수 있어요.',
        }
      }
      return {
        type: 'error',
        text: '서버의 GitHub 토큰으로는 이 레포에 접근할 수 없어요. 레포의 조직이 토큰 접근을 제한하고 있을 수 있어요.',
      }
    }
    if (err.status === 451) {
      return { type: 'error', text: '이 레포는 GitHub에서 접근이 차단되어 있어서 분석할 수 없어요.' }
    }
  }
  console.error(err)
  return { type: 'error', text: '분석 중에 문제가 생겼어요. 잠시 뒤에 다시 시도해 주세요.', action: 'retry' }
}

/** README와 긴 트리를 그대로 보내지 않고, 얕은 경로 위주로 줄여서 보내요. */
function compactTree(paths: string[]): string {
  const shallow = paths.filter((path) => path.replace(/\/$/, '').split('/').length <= 2 && !isExcludedFile(path))
  const lines = shallow.slice(0, TREE_LIMIT)
  if (shallow.length > lines.length) lines.push(`(이 밖에 ${shallow.length - lines.length}개 경로 생략)`)
  return lines.join('\n')
}

function fallbackSummary(repo: Repo, languages: Record<string, number>): string {
  const top = Object.entries(languages).sort((a, b) => b[1] - a[1])[0]?.[0]
  return top ? `**${top}**로 만든 **${repo.name}** 레포지토리네요!` : `**${repo.name}** 레포지토리네요!`
}

/** 기술 스택을 알아내는 데 쓰는 의존성 파일과 설정 파일 (앞에 있을수록 먼저 읽어요) */
const MANIFEST_FILES = [
  'build.gradle',
  'build.gradle.kts',
  'pom.xml',
  'package.json',
  'requirements.txt',
  'pyproject.toml',
  'go.mod',
  'Cargo.toml',
  'Gemfile',
  'composer.json',
  'pubspec.yaml',
  'docker-compose.yml',
  'docker-compose.yaml',
  'Dockerfile',
]
const MANIFEST_MAX_FILES = 3
const MANIFEST_LIMIT = 2500

/** 레포 위쪽에 있는 의존성 파일을 몇 개 골라서 내용을 읽어 와요. */
async function readManifests(gh: GitHub, owner: string, repo: string, tree: string[]): Promise<string> {
  const picked = tree
    .filter((path) => !path.endsWith('/') && path.split('/').length <= 2 && !isExcludedFile(path))
    .map((path) => ({ path, rank: MANIFEST_FILES.indexOf(path.split('/').pop()!) }))
    .filter((file) => file.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.path.length - b.path.length)
    .slice(0, MANIFEST_MAX_FILES)

  const contents = await Promise.all(picked.map((file) => gh.getFile(owner, repo, file.path).catch(() => '')))
  return picked
    .map((file, index) => (contents[index] ? `--- ${file.path}\n${truncate(contents[index], MANIFEST_LIMIT)}` : ''))
    .filter(Boolean)
    .join('\n\n')
}

interface RepoIntro {
  text: string
  stack: StackGroup[]
  fromAi: boolean
}

/**
 * 어떤 서비스의 어떤 레포인지 한 문장으로 정의하고 기술 스택을 정리해요.
 * AI를 쓸 수 없으면 언어와 이름으로 대신해요.
 */
async function describeRepo(gh: GitHub, repo: Repo, baseKey: string): Promise<RepoIntro> {
  const cached = summaryCache.get(baseKey)
  if (cached) return cached

  const owner = repo.owner.login
  const [readme, tree, languages] = await Promise.all([
    gh.getReadme(owner, repo.name),
    gh.getTree(owner, repo.name, repo.default_branch),
    gh.getLanguages(owner, repo.name),
  ])

  if (aiEnabled) {
    try {
      const result = await summarizeRepo({
        fullName: repo.full_name,
        description: repo.description,
        languages,
        tree: compactTree(tree),
        readme: truncate(readme, README_LIMIT),
        manifests: await readManifests(gh, owner, repo.name, tree),
      })
      const intro = { text: result.sentence, stack: result.stack, fromAi: true }
      summaryCache.set(baseKey, intro)
      return intro
    } catch (err) {
      console.error(err)
    }
  }

  const topLanguages = Object.entries(languages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name]) => name)
  return {
    text: sanitize(fallbackSummary(repo, languages)),
    stack: topLanguages.length > 0 ? [{ category: '언어', items: topLanguages }] : [],
    fromAi: false,
  }
}

const firstLine = (message: string) => message.split('\n')[0].trim()

/** 고르게 퍼진 대표 커밋을 n개 골라요. */
function pickSpread<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items
  const step = (items.length - 1) / (count - 1)
  return Array.from({ length: count }, (_, i) => items[Math.round(i * step)])
}

function buildDiff(commits: CommitDetail[]): string {
  let total = ''
  for (const commit of commits) {
    const files = (commit.files ?? []).filter((file) => !isExcludedFile(file.filename))
    let block = `### ${firstLine(commit.commit.message)}\n`
    for (const file of files) {
      if (!file.patch) continue
      const part = `--- ${file.filename}\n${truncate(file.patch, FILE_PATCH_LIMIT)}\n`
      if (block.length + part.length > COMMIT_DIFF_LIMIT) break
      block += part
    }
    if (total.length + block.length > CONTRIBUTOR_DIFF_LIMIT) break
    total += `${block}\n`
  }
  return total.trim()
}

function topDirectories(commits: CommitDetail[]): string[] {
  const counts = new Map<string, number>()
  for (const commit of commits) {
    for (const file of commit.files ?? []) {
      if (isExcludedFile(file.filename)) continue
      const segments = file.filename.split('/')
      const dir = segments.length === 1 ? '(루트)' : segments.slice(0, Math.min(2, segments.length - 1)).join('/')
      counts.set(dir, (counts.get(dir) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([dir]) => dir)
}

interface Profile {
  features: string[]
  style: string[]
}

async function profileContributor(
  gh: GitHub,
  owner: string,
  repo: string,
  person: Ranked,
  collected: Collected,
  pulls: Pull[],
  repoSummary: string,
): Promise<Profile> {
  let messages: string[]
  let samples: CommitDetail[]

  const known = collected.commitsByKey?.get(person.key)
  if (known) {
    messages = known.map((commit) => firstLine(commit.commit.message))
    samples = pickSpread(known, SAMPLE_COMMITS)
  } else {
    // 작성자로 걸러서 조회하면 일부 이메일로 올린 커밋이 빠지는 경우가 있어서, 미리 받아 둔 목록에서 먼저 찾아요.
    const login = person.login!.toLowerCase()
    let recent = (collected.recentCommits ?? []).filter(
      (commit) => !isMergeCommit(commit) && commit.author?.login.toLowerCase() === login,
    )
    if (recent.length === 0) {
      recent = (await gh.listCommits(owner, repo, { author: person.login!, perPage: 100 })).filter(
        (commit) => !isMergeCommit(commit),
      )
    }
    messages = recent.map((commit) => firstLine(commit.commit.message))
    samples = await Promise.all(pickSpread(recent, SAMPLE_COMMITS).map((commit) => gh.getCommit(owner, repo, commit.sha)))
  }

  return analyzeContributor({
    name: person.name,
    repoSummary,
    topPaths: topDirectories(samples),
    commitMessages: messages.slice(0, COMMIT_MESSAGE_LIMIT).map((message) => truncate(message, 120)),
    pullTitles: pulls
      .filter((pull) => person.login && pull.user?.login.toLowerCase() === person.login.toLowerCase())
      .slice(0, PULL_TITLE_LIMIT)
      .map((pull) => truncate(pull.title, 120)),
    diffs: buildDiff(samples),
  })
}

async function collect(
  gh: GitHub,
  owner: string,
  repo: string,
  excludeGenerated: boolean,
): Promise<Collected> {
  if (excludeGenerated) return fromCommits(gh, owner, repo, { exclude: true })

  const raw = await gh.getContributorStats(owner, repo)
  const people = raw ? fromStatsApi(raw) : []
  // 통계가 끝내 준비되지 않았거나, 커밋이 아주 많은 레포라 라인 수가 비어 있으면 커밋을 직접 읽어요.
  const usable = people.length > 0 && people.some((person) => person.additions + person.deletions > 0)
  if (usable) {
    // 커밋 목록 전체를 받을 수 있는 크기라면, 통계 API가 잘못 나눈 몫을 원래 참여자에게 합쳐요.
    const listed = await gh.listCommits(owner, repo, { perPage: 100, maxPages: Math.ceil(MAX_COMMITS / 100) })
    return {
      people: listed.length < MAX_COMMITS ? mergeMisattributed(people, listed) : people,
      recentCommits: listed,
      capped: false,
    }
  }
  return fromCommits(gh, owner, repo, { exclude: false })
}

function toPublic({ key: _key, ...stats }: Ranked): ContributorStats {
  return { ...stats, name: sanitize(stats.name) || '이름 없는 작성자' }
}

export async function runAnalysis(options: {
  url: string
  /** 아직 정하지 않았다면 undefined. 레포를 확인한 뒤 사용자에게 먼저 물어봐요. */
  excludeGenerated: boolean | undefined
  /** 분석이 끝난 뒤의 추가 질문 */
  question?: FollowupQuestion
  person?: string
  timeZone?: string
  emit: Emit
  isAborted: () => boolean
}): Promise<void> {
  const { url, excludeGenerated, isAborted } = options
  const recorded: ChatEvent[] = []
  const emit: Emit = (event) => {
    recorded.push(event)
    options.emit(event)
  }

  const parsed = parseRepoUrl(url)
  if (!parsed) {
    emit({
      type: 'error',
      text: 'GitHub 레포 주소가 아닌 것 같아요. https://github.com/소유자/레포이름 형식으로 입력해 주세요.',
    })
    return
  }
  const { owner, repo: repoName } = parsed

  const gh = createGitHub(env.githubToken)

  let repo: Repo
  try {
    repo = await gh.getRepo(owner, repoName)
  } catch (err) {
    emit(repoErrorEvent(err))
    return
  }

  // 비공개 레포는 분석하지 않아요. 서버 토큰이 볼 수 있는 레포여도 결과를 내보내지 않아요.
  if (repo.private) {
    emit({ type: 'error', text: '**비공개 레포**는 분석할 수 없어요. 공개 레포 링크를 입력해 주세요.' })
    return
  }

  const baseKey = `${repo.id}:${repo.pushed_at ?? 'empty'}`

  if (options.question) {
    try {
      await answerFollowup({
        gh,
        owner,
        repo: repoName,
        cacheKey: baseKey,
        question: options.question,
        person: options.person,
        timeZone: options.timeZone,
        emit: options.emit,
      })
    } catch (err) {
      options.emit(repoErrorEvent(err))
    }
    return
  }

  // 먼저 어떤 레포인지 한 문장으로 소개한 다음, 라인 수를 어떻게 셀지 물어봐요.
  if (excludeGenerated === undefined) {
    try {
      const summary = await describeRepo(gh, repo, baseKey)
      options.emit({ type: 'text', text: summary.text })
      if (summary.stack.length > 0) {
        options.emit({ type: 'stack', text: '이런 기술로 만들었어요.', groups: summary.stack })
      }
    } catch (err) {
      options.emit(repoErrorEvent(err))
      return
    }
    options.emit({
      type: 'ask',
      text: `lock 파일, 빌드 결과물, 자동 생성 파일은 라인 수에서 빼고 계산할까요? 빼고 계산하면 더 정확하지만, 커밋을 하나씩 읽어서 시간이 더 걸리고 최근 ${formatNumber(MAX_COMMITS)}개 커밋까지만 살펴봐요.`,
    })
    return
  }

  const resultKey = `${baseKey}:${excludeGenerated ? 'commits' : 'stats'}`

  const cached = resultCache.get(resultKey)
  if (cached) {
    cached.forEach(options.emit)
    return
  }

  let cacheable = true

  try {
    emit({ type: 'text', text: 'GitHub에서 생성된 통계를 가져오고 있어요.\n잠시만 기다려 주세요!' })
    const collecting = collect(gh, owner, repoName, excludeGenerated)
    // 아래에서 await하기 전에 실패해도 처리되지 않은 거절로 남지 않게 해요.
    collecting.catch(() => {})

    // 레포 소개는 질문 전에 이미 보여줬어요. 여기서는 역할 분석에 참고하려고 캐시에서 다시 꺼내요.
    let repoSummary = ''
    if (aiEnabled) {
      const summary = await describeRepo(gh, repo, baseKey)
      if (summary.fromAi) repoSummary = summary.text
      else cacheable = false
    }

    const collected = await collecting
    const ranked = rank(collected.people)
    if (isAborted()) return

    if (ranked.length === 0) {
      emit({ type: 'text', text: '아직 분석할 커밋이 없는 레포예요.' })
      return
    }

    if (collected.capped) {
      emit({ type: 'text', text: `커밋이 많아서 최근 ${formatNumber(MAX_COMMITS)}개만 살펴봤어요.` })
    }

    const detailed = ranked.slice(0, MAX_DETAILED)
    const withProfiles = aiEnabled

    emit({
      type: 'text',
      text:
        ranked.length === 1
          ? '🎉 이 프로젝트는 **1명**이 혼자 만들었네요!'
          : `🎉 이 프로젝트에 **${formatNumber(ranked.length)}명**이 참여했네요!`,
    })

    // 역할과 코드 스타일 분석은 미리 한꺼번에 시작해 두고, 화면에는 기여도 순서대로 내보내요.
    let profiles: Promise<Profile | null>[] = []
    if (withProfiles) {
      const pulls = await gh.listPulls(owner, repoName).catch(() => [] as Pull[])
      const settled = new Map<number, (profile: Profile | null) => void>()
      profiles = detailed.map((_, index) => new Promise<Profile | null>((resolve) => settled.set(index, resolve)))
      void mapLimit(detailed, AI_CONCURRENCY, async (person, index) => {
        try {
          if (isAborted()) throw new Error('요청이 취소됐어요.')
          settled.get(index)!(await profileContributor(gh, owner, repoName, person, collected, pulls, repoSummary))
        } catch (err) {
          if (!isAborted()) console.error(err)
          settled.get(index)!(null)
        }
      })
    }

    const cards = detailed.map(toPublic)
    // 순위 숫자를 읽고 풀어 주는 설명은 카드를 보여주는 동안 미리 받아 둬요.
    const rankingStory =
      cards.length > 1
        ? narrateOrNull(
            '참여자별 기여도',
            cards.map(({ name, commits, additions, deletions, commitShare, lineShare }) => ({
              name,
              commits,
              additions,
              deletions,
              commitShare,
              lineShare,
            })),
            '커밋 수 기준과 라인 수 기준 순위가 어떻게 다른지, 누가 작게 자주 올리고 누가 한 번에 크게 올리는 편인지, 기여가 고르게 나뉘었는지 한쪽에 쏠렸는지 짚어 줘요.',
          )
        : null
    emit({
      type: 'ranking',
      text:
        ranked.length === 1
          ? `**${cards[0].name}**님이 혼자 만든 레포예요.`
          : `**${cards[0].name}**님이 가장 많이 기여했어요. ${cards
              .slice(1, 3)
              .map((card, index) => `${index + 2}위는 ${card.name}님`)
              .join(', ')}이에요.`,
      contributors: cards,
    })

    const rankingText = await rankingStory
    if (rankingText) emit({ type: 'text', text: rankingText })
    else if (rankingStory) cacheable = false

    const teamNotes: { name: string; features: string[]; style: string[] }[] = []

    if (withProfiles) {
      // 한 단계가 끝날 때마다 멈춰서, 사용자가 읽고 계속하기를 눌러야 다음으로 넘어가요.
      // 먼저 모든 참여자의 기능을 이어서 보여주고, 그다음에 코드 스타일을 이어서 보여줘요.
      emit({ type: 'pause', next: '누가 어떤 기능을 맡았는지 살펴보기' })
      emit({ type: 'text', text: '누가 어떤 기능을 맡았는지 분석해볼게요!' })
      const styles: { name: string; items: string[] }[] = []
      for (const [index, card] of cards.entries()) {
        if (isAborted()) return
        const profile = await profiles[index]
        if (profile) {
          emit({ type: 'list', text: `**${card.name}**님이 맡은 기능이에요.`, items: profile.features })
          styles.push({ name: card.name, items: profile.style })
          teamNotes.push({ name: card.name, features: profile.features, style: profile.style })
        } else {
          cacheable = false
          emit({ type: 'text', text: `${card.name}님이 맡은 기능은 이번에는 분석하지 못했어요.` })
        }
      }

      if (styles.length > 0) {
        emit({ type: 'pause', next: '참여자들의 코드 스타일 살펴보기' })
        emit({ type: 'text', text: '이번엔 참여자들의 코드 스타일을 분석해볼게요!' })
        for (const style of styles) {
          emit(
            style.items.length > 0
              ? { type: 'list', text: `**${style.name}**님의 코드 스타일이에요.`, items: style.items }
              : { type: 'text', text: `${style.name}님은 살펴볼 코드 변경이 적어서 코드 스타일을 파악하기 어려웠어요.` },
          )
        }
      }
    } else {
      cacheable = false
      emit({ type: 'text', text: 'AI 분석이 설정되어 있지 않아서 기능과 코드 스타일은 보여드리지 못했어요.' })
    }

    emit({ type: 'pause', next: '전체 기여도 비교와 팀 총평 보기' })

    const rest = ranked.length - detailed.length
    if (rest > 0) {
      emit({ type: 'text', text: `나머지 ${formatNumber(rest)}명은 아래 요약에서 함께 보여드릴게요.` })
    }

    emit({
      type: 'summary',
      text: excludeGenerated
        ? '마지막으로 전체 기여도를 한눈에 비교해 봤어요. 라인 수는 lock 파일과 빌드 결과물을 빼고 계산했어요.'
        : '마지막으로 전체 기여도를 한눈에 비교해 봤어요.',
      contributors: ranked.slice(0, MAX_CHART).map(toPublic),
      othersCount: Math.max(0, ranked.length - MAX_CHART),
    })

    // 마지막으로 팀이 어떻게 일했는지 전체적인 인상을 풀어서 말해 줘요.
    if (teamNotes.length > 0 && !isAborted()) {
      const closing = await narrateOrNull(
        '이 팀은 전체적으로 어떻게 일했나요?',
        {
          repo: repoSummary,
          contributors: cards.map((card) => ({
            name: card.name,
            commitShare: card.commitShare,
            lineShare: card.lineShare,
            ...teamNotes.find((note) => note.name === card.name),
          })),
        },
        '"전체적으로"로 시작해서, 역할이 어떻게 나뉘었는지와 팀의 작업 방식에서 느껴지는 인상을 총평처럼 말해 줘요. 한 사람만 참여했다면 그 사람의 작업 방식을 말해 줘요.',
      )
      if (closing) emit({ type: 'text', text: closing })
      else cacheable = false
    }

    emit(followupEvent(ranked.map((person) => ({ id: personId(person.login, person.name), name: sanitize(person.name) }))))

    if (cacheable && !isAborted()) resultCache.set(resultKey, recorded)
  } catch (err) {
    if (isAborted()) return
    emit(repoErrorEvent(err))
  }
}
