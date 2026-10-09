import type { ChatEvent, ContributorStats } from '../shared/types.ts'
import { TtlCache } from './cache.ts'
import { aiEnabled, analyzeContributor, summarizeRepo } from './claude.ts'
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
import { formatNumber, sanitize, truncate } from './text.ts'

/** 역할과 코드 스타일까지 자세히 소개하는 최대 인원 */
const MAX_DETAILED = 10
/** 마지막 요약 그래프에 그리는 최대 인원 */
const MAX_CHART = 15
const AI_CONCURRENCY = 3

// Claude에 보내는 자료 길이 제한 (비용 절감)
const README_LIMIT = 6000
const TREE_LIMIT = 150
const SAMPLE_COMMITS = 3
const FILE_PATCH_LIMIT = 1500
const COMMIT_DIFF_LIMIT = 3500
const CONTRIBUTOR_DIFF_LIMIT = 9000
const COMMIT_MESSAGE_LIMIT = 20
const PULL_TITLE_LIMIT = 10

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const resultCache = new TtlCache<ChatEvent[]>(CACHE_TTL_MS, 300)
const summaryCache = new TtlCache<string>(CACHE_TTL_MS, 300)

export interface Requester {
  id: number
  token: string
}

type Emit = (event: ChatEvent) => void

type Ranked = ContributorStats & { key: string }

/** 여러 형태의 GitHub 레포 주소에서 owner와 repo를 뽑아내요. */
export function parseRepoUrl(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim()
  const match =
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s?#]+)/i.exec(trimmed) ??
    /^git@github\.com:([^/\s]+)\/([^/\s]+)$/i.exec(trimmed) ??
    /^([^/\s]+)\/([^/\s]+)$/.exec(trimmed)
  if (!match) return null
  const owner = match[1]
  const repo = match[2].replace(/\.git$/i, '')
  const valid = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(owner) && /^[A-Za-z0-9._-]+$/.test(repo)
  return valid && repo !== '.' && repo !== '..' ? { owner, repo } : null
}

function rateLimitMessage(err: GitHubError): string {
  if (!err.resetAt) return 'GitHub API 호출 제한을 넘었어요. 잠시 뒤에 다시 시도해 주세요.'
  const minutes = Math.max(1, Math.ceil((err.resetAt - Date.now()) / 60000))
  return `GitHub API 호출 제한을 넘었어요. 약 ${minutes}분 뒤에 다시 시도해 주세요.`
}

function repoErrorEvent(err: unknown, loggedIn: boolean): ChatEvent {
  if (err instanceof GitHubError) {
    if (err.rateLimited) {
      return loggedIn
        ? { type: 'error', text: rateLimitMessage(err) }
        : { type: 'error', text: `${rateLimitMessage(err)} GitHub로 로그인하면 바로 이어서 분석할 수 있어요.`, action: 'login' }
    }
    if (err.status === 404) {
      return loggedIn
        ? {
            type: 'error',
            text: '레포를 찾을 수 없어요. 주소가 정확한지 확인해 주세요. 비공개 레포라면 이 계정에 접근 권한이 없는 것일 수 있어요.',
          }
        : {
            type: 'error',
            text: '레포를 찾을 수 없어요. 주소가 틀렸거나 비공개 레포일 수 있어요. 비공개 레포라면 GitHub로 로그인하면 분석할 수 있어요.',
            action: 'login',
          }
    }
    if (err.status === 401) {
      return loggedIn
        ? { type: 'error', text: '로그인이 만료됐어요. 다시 로그인해 주세요.', action: 'login' }
        : { type: 'error', text: '서버의 GitHub 토큰에 문제가 있어요. 관리자에게 알려주세요.' }
    }
    if (err.status === 403) {
      // 조직이 만료 기간이 긴 fine-grained 토큰을 막아 둔 경우예요. 공개 레포여도 403이 와요.
      if (/token's lifetime/i.test(err.detail)) {
        return {
          type: 'error',
          text: loggedIn
            ? '이 레포의 조직은 만료 기간이 366일을 넘는 GitHub 토큰의 접근을 막고 있어요.'
            : '이 레포의 조직은 만료 기간이 366일을 넘는 GitHub 토큰의 접근을 막고 있어요. 서버의 GITHUB_TOKEN 만료 기간을 366일 이하로 바꾸면 분석할 수 있어요.',
        }
      }
      return {
        type: 'error',
        text: loggedIn
          ? '이 레포에 접근할 권한이 없어요. 레포의 조직에서 이 앱의 접근을 허용했는지 확인해 주세요.'
          : '서버의 GitHub 토큰으로는 이 레포에 접근할 수 없어요. 레포의 조직이 토큰 접근을 제한하고 있을 수 있어요.',
      }
    }
    if (err.status === 451) {
      return { type: 'error', text: '이 레포는 GitHub에서 접근이 차단되어 있어서 분석할 수 없어요.' }
    }
  }
  console.error(err)
  return { type: 'error', text: '분석 중에 문제가 생겼어요. 잠시 뒤에 다시 시도해 주세요.' }
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
  return top ? `${top}로 만든 ${repo.name} 레포지토리네요!` : `${repo.name} 레포지토리네요!`
}

/** 어떤 서비스의 어떤 레포인지 한 문장으로 정의해요. AI를 쓸 수 없으면 언어와 이름으로 대신해요. */
async function describeRepo(gh: GitHub, repo: Repo, baseKey: string): Promise<{ text: string; fromAi: boolean }> {
  const cached = summaryCache.get(baseKey)
  if (cached) return { text: cached, fromAi: true }

  const owner = repo.owner.login
  const [readme, tree, languages] = await Promise.all([
    gh.getReadme(owner, repo.name),
    gh.getTree(owner, repo.name, repo.default_branch),
    gh.getLanguages(owner, repo.name),
  ])

  if (aiEnabled) {
    try {
      const text = await summarizeRepo({
        fullName: repo.full_name,
        description: repo.description,
        languages,
        tree: compactTree(tree),
        readme: truncate(readme, README_LIMIT),
      })
      summaryCache.set(baseKey, text)
      return { text, fromAi: true }
    } catch (err) {
      console.error(err)
    }
  }
  return { text: sanitize(fallbackSummary(repo, languages)), fromAi: false }
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
  role: string
  style: string
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
    const recent = (await gh.listCommits(owner, repo, { author: person.login!, perPage: 30 })).filter(
      (commit) => !isMergeCommit(commit),
    )
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
  onPending: () => void,
): Promise<Collected> {
  if (excludeGenerated) return fromCommits(gh, owner, repo, { exclude: true })

  const raw = await gh.getContributorStats(owner, repo, onPending)
  const people = raw ? fromStatsApi(raw) : []
  // 통계가 끝내 준비되지 않았거나, 커밋이 아주 많은 레포라 라인 수가 비어 있으면 커밋을 직접 읽어요.
  const usable = people.length > 0 && people.some((person) => person.additions + person.deletions > 0)
  if (usable) {
    // 커밋 목록 전체를 받을 수 있는 크기라면, 통계 API가 잘못 나눈 몫을 원래 참여자에게 합쳐요.
    const listed = await gh.listCommits(owner, repo, { perPage: 100, maxPages: Math.ceil(MAX_COMMITS / 100) })
    return { people: listed.length < MAX_COMMITS ? mergeMisattributed(people, listed) : people, capped: false }
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
  requester: Requester | null
  emit: Emit
  isAborted: () => boolean
}): Promise<void> {
  const { url, excludeGenerated, requester, isAborted } = options
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

  const token = requester?.token ?? env.githubToken
  const gh = createGitHub(token)

  let repo: Repo
  try {
    repo = await gh.getRepo(owner, repoName)
  } catch (err) {
    emit(repoErrorEvent(err, !!requester))
    return
  }

  if (repo.private && !requester) {
    emit({ type: 'error', text: '비공개 레포네요. GitHub로 로그인하면 분석할 수 있어요.', action: 'login' })
    return
  }

  // 비공개 레포의 결과는 사용자별로 따로 캐싱해서 다른 사람에게 보이지 않게 해요.
  // 접근 권한은 위에서 요청자의 토큰으로 매번 다시 확인해요.
  const scope = repo.private ? `user:${requester!.id}` : 'public'
  const baseKey = `${scope}:${repo.id}:${repo.pushed_at ?? 'empty'}`

  // 먼저 어떤 레포인지 한 문장으로 소개한 다음, 라인 수를 어떻게 셀지 물어봐요.
  if (excludeGenerated === undefined) {
    try {
      const summary = await describeRepo(gh, repo, baseKey)
      options.emit({ type: 'text', text: summary.text })
    } catch (err) {
      options.emit(repoErrorEvent(err, !!requester))
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
    const collecting = collect(gh, owner, repoName, excludeGenerated, () =>
      emit({ type: 'text', text: 'GitHub가 통계를 만들고 있어요. 조금만 기다려 주세요.' }),
    )
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
          ? '참여한 사람은 1명이에요. 이제 분석을 시작할게요.'
          : `참여한 사람은 총 ${formatNumber(ranked.length)}명이에요. 이제 분석을 시작할게요.`,
    })
    if (!aiEnabled) {
      cacheable = false
      emit({ type: 'text', text: 'AI 분석이 설정되어 있지 않아서 지금은 수치만 보여드릴게요.' })
    }

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

    for (const [index, person] of detailed.entries()) {
      if (isAborted()) return
      const stats = toPublic(person)
      const text =
        ranked.length === 1
          ? `${stats.name}님이 혼자 만든 레포예요.`
          : index === 0
            ? `${stats.name}님이 가장 많이 기여했어요.`
            : index === detailed.length - 1 && ranked.length === detailed.length
              ? `마지막으로 ${stats.name}님이에요.`
              : `다음은 ${stats.name}님이에요.`
      emit({ type: 'stats', text, contributor: stats })

      if (!withProfiles) continue
      const profile = await profiles[index]
      if (profile) {
        emit({ type: 'text', text: profile.role })
        emit({ type: 'text', text: profile.style })
      } else {
        cacheable = false
        emit({ type: 'text', text: `${stats.name}님의 역할과 코드 스타일은 이번에는 분석하지 못했어요.` })
      }
    }

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

    if (cacheable && !isAborted()) resultCache.set(resultKey, recorded)
  } catch (err) {
    if (isAborted()) return
    emit(repoErrorEvent(err, !!requester))
  }
}
