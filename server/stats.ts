import type { ContributorStats } from '../shared/types.ts'
import { mapLimit, type CommitDetail, type CommitSummary, type GitHub, type StatsContributor } from './github.ts'

/** 커밋 단위 분석에서 살펴보는 최대 커밋 수 (최근 순) */
export const MAX_COMMITS = 300
const COMMIT_FETCH_CONCURRENCY = 6

const LOCK_FILES = new Set([
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lock',
  'bun.lockb',
  'cargo.lock',
  'gemfile.lock',
  'poetry.lock',
  'pipfile.lock',
  'uv.lock',
  'composer.lock',
  'go.sum',
  'podfile.lock',
  'packages.lock.json',
  'flake.lock',
  'pubspec.lock',
  'mix.lock',
])

const BUILD_DIRS = new Set([
  'dist',
  'build',
  'out',
  'node_modules',
  'vendor',
  '.next',
  '.nuxt',
  '.output',
  'coverage',
  'target',
  '__pycache__',
  '.gradle',
  'pods',
])

const GENERATED_PATTERN =
  /(\.min\.(js|css)|\.map|\.snap|\.pb\.go|_pb2(_grpc)?\.py|\.g\.dart|\.freezed\.dart|\.generated\.[a-z]+|\.designer\.cs)$/

const BINARY_PATTERN =
  /\.(png|jpe?g|gif|webp|avif|ico|bmp|tiff?|psd|ai|sketch|fig|pdf|zip|gz|tgz|tar|rar|7z|jar|war|class|exe|dll|so|dylib|bin|dat|woff2?|ttf|otf|eot|mp3|mp4|mov|avi|webm|wav|ogg|sqlite|db)$/

/** lock 파일, 빌드 결과물, 자동 생성 파일, 바이너리 파일인지 판단해요. */
export function isExcludedFile(path: string): boolean {
  const lower = path.toLowerCase()
  const segments = lower.split('/')
  const fileName = segments[segments.length - 1]
  if (LOCK_FILES.has(fileName)) return true
  if (segments.slice(0, -1).some((dir) => BUILD_DIRS.has(dir))) return true
  return GENERATED_PATTERN.test(fileName) || BINARY_PATTERN.test(fileName)
}

export interface Person {
  key: string
  login: string | null
  name: string
  avatarUrl: string | null
  profileUrl: string | null
  commits: number
  additions: number
  deletions: number
}

export interface Collected {
  people: Person[]
  /** 커밋 단위 분석일 때만 채워져요. 사람별 커밋 상세 (최근 순) */
  commitsByKey?: Map<string, CommitDetail[]>
  /** 커밋이 MAX_COMMITS보다 많아서 최근 것만 본 경우 */
  capped: boolean
}

const isBot = (account: { login: string; type: string } | null) =>
  !!account && (account.type === 'Bot' || account.login.endsWith('[bot]'))

export const isMergeCommit = (commit: CommitSummary) => commit.parents.length > 1

/** /stats/contributors 응답을 사람별 수치로 바꿔요. GitHub가 이미 계정 기준으로 합쳐서 줘요. */
export function fromStatsApi(raw: StatsContributor[]): Person[] {
  return raw
    .filter((item) => item.author && !isBot(item.author))
    .map((item) => {
      const author = item.author!
      return {
        key: `u:${author.login.toLowerCase()}`,
        login: author.login,
        name: author.login,
        avatarUrl: author.avatar_url,
        profileUrl: author.html_url,
        commits: item.total,
        additions: item.weeks.reduce((sum, week) => sum + week.a, 0),
        deletions: item.weeks.reduce((sum, week) => sum + week.d, 0),
      }
    })
}

const NOREPLY_PATTERN = /^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/

/**
 * 커밋 작성자를 GitHub 계정으로 이어 주는 함수를 만들어요.
 * 계정이 연결된 커밋에서 이메일과 이름을 모아두고, 연결되지 않은 커밋을 같은 계정으로 묶는 데 써요.
 */
function createLoginResolver(commits: CommitSummary[]) {
  const loginByEmail = new Map<string, string>()
  const loginsByName = new Map<string, Set<string>>()
  const knownLogins = new Map<string, string>()
  for (const commit of commits) {
    const login = commit.author?.login
    const git = commit.commit.author
    if (login) knownLogins.set(login.toLowerCase(), login)
    if (!login || !git) continue
    if (git.email) loginByEmail.set(git.email.toLowerCase(), login)
    if (git.name) {
      const set = loginsByName.get(git.name) ?? new Set<string>()
      set.add(login)
      loginsByName.set(git.name, set)
    }
  }

  return function resolveLogin(commit: CommitSummary): string | null {
    if (commit.author?.login) return commit.author.login
    const git = commit.commit.author
    if (!git) return null
    const email = git.email?.toLowerCase() ?? ''
    const byEmail = loginByEmail.get(email)
    if (byEmail) return byEmail
    const noreply = NOREPLY_PATTERN.exec(email)
    if (noreply) return noreply[1]
    const byName = loginsByName.get(git.name)
    if (byName?.size === 1) return [...byName][0]
    // 커밋 작성자 이름이 이미 참여 중인 계정의 아이디와 같으면 같은 사람으로 봐요.
    return knownLogins.get(git.name?.trim().toLowerCase() ?? '') ?? null
  }
}

/**
 * 통계 API가 계정이 연결되지 않은 커밋을 엉뚱한 계정 몫으로 돌려주는 경우를 바로잡아요.
 * 커밋 목록에는 한 번도 작성자로 나오지 않는 계정이 있고, 연결되지 않은 커밋이 같은 수만큼
 * 다른 참여자의 것으로 확인되면 그 참여자에게 합쳐요. 커밋 목록 전체를 받은 경우에만 써요.
 */
export function mergeMisattributed(people: Person[], commits: CommitSummary[]): Person[] {
  const targets = commits.filter((commit) => !isMergeCommit(commit))
  const resolveLogin = createLoginResolver(targets)

  const linked = new Set<string>()
  const recovered = new Map<string, number>()
  for (const commit of targets) {
    if (commit.author?.login) {
      linked.add(commit.author.login.toLowerCase())
      continue
    }
    const login = resolveLogin(commit)?.toLowerCase()
    if (login) recovered.set(login, (recovered.get(login) ?? 0) + 1)
  }

  const byLogin = new Map(people.map((person) => [person.login?.toLowerCase() ?? person.key, person]))
  const removed = new Set<Person>()
  for (const person of people) {
    const login = person.login?.toLowerCase()
    if (!login || linked.has(login)) continue
    const owners = [...recovered].filter(([owner, count]) => count === person.commits && byLogin.has(owner))
    if (owners.length !== 1) continue
    const owner = byLogin.get(owners[0][0])!
    owner.commits += person.commits
    owner.additions += person.additions
    owner.deletions += person.deletions
    recovered.delete(owners[0][0])
    removed.add(person)
  }
  return people.filter((person) => !removed.has(person))
}

/**
 * 커밋을 하나씩 읽어서 사람별 수치를 계산해요.
 * 같은 사람이 여러 이메일로 커밋했더라도 GitHub 계정 기준으로 합쳐요.
 */
export async function fromCommits(
  gh: GitHub,
  owner: string,
  repo: string,
  options: { exclude: boolean },
): Promise<Collected> {
  const pages = Math.ceil(MAX_COMMITS / 100)
  const listed = await gh.listCommits(owner, repo, { perPage: 100, maxPages: pages })
  const capped = listed.length >= MAX_COMMITS
  const targets = listed.filter((commit) => !isMergeCommit(commit) && !isBot(commit.author))

  const resolveLogin = createLoginResolver(targets)

  const details = await mapLimit(targets, COMMIT_FETCH_CONCURRENCY, (commit) => gh.getCommit(owner, repo, commit.sha))

  const people = new Map<string, Person>()
  const commitsByKey = new Map<string, CommitDetail[]>()

  details.forEach((detail, index) => {
    const summary = targets[index]
    const login = resolveLogin(summary)
    const git = summary.commit.author
    // 계정을 끝내 찾지 못한 작성자는 이름이 같으면 한 사람으로 합쳐요.
    const key = login ? `u:${login.toLowerCase()}` : `n:${(git?.name?.trim() || git?.email || 'unknown').toLowerCase()}`

    let person = people.get(key)
    if (!person) {
      person = {
        key,
        login,
        name: login ?? git?.name ?? '알 수 없는 작성자',
        avatarUrl: login ? `https://github.com/${login}.png?size=96` : null,
        profileUrl: login ? `https://github.com/${login}` : null,
        commits: 0,
        additions: 0,
        deletions: 0,
      }
      people.set(key, person)
    }
    if (summary.author?.avatar_url) person.avatarUrl = summary.author.avatar_url

    person.commits += 1
    for (const file of detail.files ?? []) {
      if (options.exclude && isExcludedFile(file.filename)) continue
      person.additions += file.additions
      person.deletions += file.deletions
    }

    const list = commitsByKey.get(key) ?? []
    list.push(detail)
    commitsByKey.set(key, list)
  })

  return { people: [...people.values()], commitsByKey, capped }
}

const percent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 1000) / 10 : 0)

/** 커밋 수 기준과 라인 수 기준 기여도를 각각 계산하고, 두 값의 평균이 큰 순서로 정렬해요. */
export function rank(people: Person[]): (ContributorStats & { key: string })[] {
  const totalCommits = people.reduce((sum, p) => sum + p.commits, 0)
  const totalLines = people.reduce((sum, p) => sum + p.additions + p.deletions, 0)

  return people
    .filter((p) => p.commits > 0)
    .map((p) => ({
      ...p,
      commitShare: percent(p.commits, totalCommits),
      lineShare: percent(p.additions + p.deletions, totalLines),
    }))
    .sort(
      (a, b) =>
        b.commitShare + b.lineShare - (a.commitShare + a.lineShare) ||
        b.commits - a.commits ||
        a.name.localeCompare(b.name),
    )
}
