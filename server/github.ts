const API = 'https://api.github.com'

const STATS_RETRY_DELAY_MS = 3000
const STATS_MAX_ATTEMPTS = 8

export class GitHubError extends Error {
  constructor(
    public status: number,
    message: string,
    public rateLimited = false,
    /** 호출 제한이 풀리는 시각 (ms) */
    public resetAt?: number,
    /** GitHub가 응답 본문에 담아 준 오류 설명 */
    public detail = '',
  ) {
    super(message)
  }
}

export interface Repo {
  id: number
  name: string
  full_name: string
  description: string | null
  private: boolean
  default_branch: string
  pushed_at: string | null
  size: number
  owner: { login: string }
}

interface Account {
  login: string
  avatar_url: string
  html_url: string
  type: string
}

export interface StatsContributor {
  author: Account | null
  total: number
  weeks: { a: number; d: number; c: number }[]
}

export interface CommitSummary {
  sha: string
  commit: { message: string; author: { name: string; email: string } | null }
  author: Account | null
  parents: { sha: string }[]
}

export interface CommitFile {
  filename: string
  additions: number
  deletions: number
  patch?: string
}

export interface CommitDetail extends CommitSummary {
  files?: CommitFile[]
}

export interface Pull {
  title: string
  user: { login: string } | null
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function createGitHub(token?: string) {
  async function request(path: string, accept = 'application/vnd.github+json'): Promise<Response> {
    const res = await fetch(`${API}${path}`, {
      headers: {
        Accept: accept,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'whoisloafing',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    if (res.ok) return res

    const body = await res.text().catch(() => '')
    const rateLimited =
      (res.status === 403 || res.status === 429) &&
      (res.headers.get('x-ratelimit-remaining') === '0' ||
        res.headers.has('retry-after') ||
        /rate limit/i.test(body))
    const reset = Number(res.headers.get('x-ratelimit-reset'))
    const retryAfter = Number(res.headers.get('retry-after'))
    const resetAt = retryAfter ? Date.now() + retryAfter * 1000 : reset ? reset * 1000 : undefined
    let detail = ''
    try {
      detail = String((JSON.parse(body) as { message?: unknown }).message ?? '')
    } catch {
      // 본문이 JSON이 아니면 설명 없이 넘어가요.
    }
    throw new GitHubError(res.status, `GitHub API ${res.status}: ${path}`, rateLimited, resetAt, detail)
  }

  async function json<T>(path: string): Promise<T> {
    return (await request(path)).json() as Promise<T>
  }

  const base = (owner: string, repo: string) => `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`

  return {
    getRepo: (owner: string, repo: string) => json<Repo>(base(owner, repo)),

    async getReadme(owner: string, repo: string): Promise<string> {
      try {
        return await (await request(`${base(owner, repo)}/readme`, 'application/vnd.github.raw+json')).text()
      } catch (err) {
        if (err instanceof GitHubError && err.status === 404) return ''
        throw err
      }
    },

    async getTree(owner: string, repo: string, branch: string): Promise<string[]> {
      try {
        const data = await json<{ tree: { path: string; type: string }[] }>(
          `${base(owner, repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
        )
        return data.tree.map((item) => (item.type === 'tree' ? `${item.path}/` : item.path))
      } catch (err) {
        // 빈 레포는 409, 브랜치가 없으면 404가 와요.
        if (err instanceof GitHubError && (err.status === 404 || err.status === 409)) return []
        throw err
      }
    },

    getLanguages: (owner: string, repo: string) => json<Record<string, number>>(`${base(owner, repo)}/languages`),

    /**
     * 통계가 아직 만들어지는 중이면 202가 오기 때문에 몇 초 간격으로 다시 시도해요.
     * 끝까지 준비되지 않으면 null을 돌려줘요.
     */
    async getContributorStats(
      owner: string,
      repo: string,
      onPending?: () => void,
    ): Promise<StatsContributor[] | null> {
      for (let attempt = 0; attempt < STATS_MAX_ATTEMPTS; attempt++) {
        const res = await request(`${base(owner, repo)}/stats/contributors`)
        if (res.status === 200) {
          const data: unknown = await res.json()
          return Array.isArray(data) ? (data as StatsContributor[]) : []
        }
        if (res.status === 204) return []
        if (res.status !== 202) return null
        if (attempt === 0) onPending?.()
        await sleep(STATS_RETRY_DELAY_MS)
      }
      return null
    },

    async listCommits(
      owner: string,
      repo: string,
      options: { author?: string; perPage?: number; maxPages?: number } = {},
    ): Promise<CommitSummary[]> {
      const perPage = options.perPage ?? 100
      const maxPages = options.maxPages ?? 1
      const all: CommitSummary[] = []
      for (let page = 1; page <= maxPages; page++) {
        const query = new URLSearchParams({ per_page: String(perPage), page: String(page) })
        if (options.author) query.set('author', options.author)
        let batch: CommitSummary[]
        try {
          batch = await json<CommitSummary[]>(`${base(owner, repo)}/commits?${query}`)
        } catch (err) {
          // 빈 레포는 409가 와요.
          if (err instanceof GitHubError && err.status === 409) return all
          throw err
        }
        all.push(...batch)
        if (batch.length < perPage) break
      }
      return all
    },

    getCommit: (owner: string, repo: string, sha: string) =>
      json<CommitDetail>(`${base(owner, repo)}/commits/${sha}`),

    listPulls: (owner: string, repo: string) =>
      json<Pull[]>(`${base(owner, repo)}/pulls?state=all&sort=updated&direction=desc&per_page=100`),
  }
}

export type GitHub = ReturnType<typeof createGitHub>

/** 동시에 limit개까지만 실행하면서 순서를 유지해요. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}
