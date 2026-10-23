import { authFetch } from './auth'
import { DEEP_ERRORS, loadConfig } from './api'
import { getLang, messages, pick } from './i18n'
import { getModel, refreshUsage } from './usage'
import { cancelSave, canSync, deleteSaved, fetchSaved, putSaved, scheduleSave } from './saved'
import { listKeys, readJson, writeItem, writeJson } from './storage'

/** 포트폴리오에 넣을 수 있는 항목. 서버의 PortfolioSection과 맞춰요. */
export type PortfolioKey = 'intro' | 'period' | 'team' | 'stack' | 'role' | 'features' | 'trouble' | 'result'

const SECTIONS = messages<{ key: PortfolioKey; title: string; hint: string }[]>({
  ko: [
    { key: 'intro', title: '프로젝트 소개', hint: '어떤 고민에서 시작했고 무엇을 만들었는지' },
    { key: 'period', title: '개발 기간', hint: '언제부터 언제까지 얼마나 작업했는지' },
    { key: 'team', title: '팀 구성', hint: '분야별로 누가 참여했는지' },
    { key: 'stack', title: '기술 스택', hint: '분야별로 사용한 기술' },
    { key: 'role', title: '맡은 역할', hint: '내가 맡아서 한 일' },
    { key: 'features', title: '주요 기능', hint: '서비스의 핵심 기능' },
    { key: 'trouble', title: '문제 해결 경험', hint: '부딪힌 문제와 해결한 방법' },
    { key: 'result', title: '성과와 배운 점', hint: '확인할 수 있는 성과와 배운 것' },
  ],
  en: [
    { key: 'intro', title: 'Project overview', hint: 'What problem it started from and what was built' },
    { key: 'period', title: 'Timeline', hint: 'When it ran and how long the work took' },
    { key: 'team', title: 'Team', hint: 'Who took part, by area' },
    { key: 'stack', title: 'Tech stack', hint: 'Technologies used, by area' },
    { key: 'role', title: 'My role', hint: 'What I owned and did' },
    { key: 'features', title: 'Key features', hint: 'The core features of the product' },
    { key: 'trouble', title: 'Problem solving', hint: 'Problems I hit and how I solved them' },
    { key: 'result', title: 'Results and learnings', hint: 'Verifiable results and what I learned' },
  ],
})

/** 포트폴리오에 넣을 수 있는 항목 목록. 지금 화면 언어의 이름이에요. */
export const portfolioSections = () => pick(SECTIONS)

export const DEFAULT_SECTIONS: PortfolioKey[] = ['intro', 'team', 'stack', 'role']

/** 항목을 고칠 때 고르는 요청. 서버의 PortfolioRevision과 맞춰요. */
export type RevisionKey = 'shorter' | 'longer' | 'numbers' | 'formal' | 'list' | 'story' | 'rewrite'

const REVISION_LABELS = messages<{ key: RevisionKey; label: string }[]>({
  ko: [
    { key: 'shorter', label: '더 짧게' },
    { key: 'longer', label: '더 자세하게' },
    { key: 'numbers', label: '수치 넣기' },
    { key: 'formal', label: '더 전문적으로' },
    { key: 'list', label: '목록으로 정리' },
    { key: 'story', label: '문장으로 풀기' },
    { key: 'rewrite', label: '다시 쓰기' },
  ],
  en: [
    { key: 'shorter', label: 'Shorter' },
    { key: 'longer', label: 'More detailed' },
    { key: 'numbers', label: 'Add numbers' },
    { key: 'formal', label: 'More professional' },
    { key: 'list', label: 'As a list' },
    { key: 'story', label: 'As prose' },
    { key: 'rewrite', label: 'Rewrite' },
  ],
})

/** 항목을 고칠 때 고르는 요청 목록. 지금 화면 언어의 이름이에요. */
export const revisions = () => pick(REVISION_LABELS)

export interface PortfolioSection {
  key: PortfolioKey
  title: string
  content: string
}

export interface PortfolioPerson {
  id: string
  login: string | null
  name: string
  avatarUrl: string | null
  commits: number
}

/** 계정(또는 이 기기)에 저장해 두는 포트폴리오 하나. 다음에 같은 레포를 열면 이어서 고쳐요. */
export interface SavedPortfolio {
  repo: string
  sections: PortfolioSection[]
  plan: string
  person: string | null
  createdAt: string
}

const ERRORS = messages<Record<string, string>>({
  ko: {
    ...DEEP_ERRORS.ko,
    C5031: '글을 쓰지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
    failed: '포트폴리오를 만들지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
  },
  en: {
    ...DEEP_ERRORS.en,
    C5031: "Couldn't write it. Please try again in a moment.",
    failed: "Couldn't create the portfolio. Please try again in a moment.",
  },
})

type Outcome<T> = { data: T } | { error: string }

async function call<T>(path: string, init?: RequestInit): Promise<Outcome<T>> {
  try {
    const result = await authFetch<T>(path, init)
    if (result.ok && result.data) {
      void refreshUsage()
      return { data: result.data }
    }
    return { error: (result.code && pick(ERRORS)[result.code]) || pick(ERRORS).failed }
  } catch {
    return { error: pick(ERRORS).network }
  }
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export function fetchPortfolioPeople(repo: string) {
  return call<PortfolioPerson[]>(`/portfolio/people?url=${encodeURIComponent(repo)}&lang=${getLang()}`)
}

export function createPortfolio(repo: string, sections: PortfolioKey[], plan: string, person: string | null) {
  return call<{ repo: string; sections: PortfolioSection[] }>('/portfolio', json({ url: repo, sections, plan: plan || null, person, lang: getLang(), model: getModel() }))
}

export function revisePortfolio(repo: string, section: PortfolioKey, revision: RevisionKey, content: string, plan: string, person: string | null) {
  return call<PortfolioSection>('/portfolio/revise', json({ url: repo, section, revision, content, plan: plan || null, person, lang: getLang(), model: getModel() }))
}

const SAVED_PREFIX = 'whoisloafing:portfolio:v1:'

const localKey = (repo: string) => `${SAVED_PREFIX}${repo.toLowerCase()}`

const savedPath = (repo: string) => `/portfolio/saved?repo=${encodeURIComponent(repo)}`

/** 이 기기에 남은 포트폴리오. unsynced는 계정에 올리지 못한 것이라 다음에 계정의 것보다 먼저 써요. */
type LocalPortfolio = SavedPortfolio & { unsynced?: boolean }

function strip({ unsynced: _unsynced, ...saved }: LocalPortfolio): SavedPortfolio {
  return saved
}

/**
 * 포트폴리오를 이미 만든 레포들(소유자/레포를 소문자로). 레포를 고르는 화면이 "이미 생성됨"을 붙이는 데 써요.
 * 이 기기에 남은 것과 계정에 저장한 것을 합쳐요.
 */
export async function fetchPortfolioRepos(): Promise<Set<string>> {
  const repos = new Set(listKeys(SAVED_PREFIX).map((key) => key.slice(SAVED_PREFIX.length)))
  if (!(await canSync()) || !(await loadConfig()).portfolioList) return repos
  const result = await authFetch<string[]>('/portfolio/saved/repos').catch(() => null)
  if (result?.ok && result.data) result.data.forEach((repo) => repos.add(repo.toLowerCase()))
  return repos
}

/** 이 기기에 남은 것. 계정에 저장하기 전에 만든 것이거나, 계정에 올리지 못한 것이에요. */
export function readPortfolio(repo: string): SavedPortfolio | null {
  const local = readJson<LocalPortfolio | null>(localKey(repo), null)
  return local && strip(local)
}

// 저장 공간이 모자라면 저장하지 않아요. 화면에는 그대로 보여요.
const writeLocal = (saved: SavedPortfolio, unsynced: boolean) => writeJson(localKey(saved.repo), unsynced ? { ...saved, unsynced } : saved)

async function upload(saved: SavedPortfolio, keepalive = false) {
  if (await putSaved('/portfolio/saved', { repo: saved.repo, data: saved }, keepalive)) writeItem(localKey(saved.repo), null)
  else writeLocal(saved, true)
}

/**
 * 계정에 저장한 포트폴리오를 불러와요. 계정에 저장할 수 없으면 이 기기의 것을 돌려줘요.
 * 계정에 없고 이 기기에만 있으면 계정에 올려서, 계정에 저장하기 전에 만든 포트폴리오를 잃지 않아요.
 */
export async function loadPortfolio(repo: string): Promise<SavedPortfolio | null> {
  const local = readJson<LocalPortfolio | null>(localKey(repo), null)
  if (!(await canSync())) return local && strip(local)
  const result = await fetchSaved<SavedPortfolio>(savedPath(repo))
  if (!result) return local && strip(local)
  if (result.data && !local?.unsynced) {
    writeItem(localKey(repo), null)
    return result.data
  }
  if (!local) return null
  await upload(strip(local))
  return strip(local)
}

export function writePortfolio(saved: SavedPortfolio) {
  void canSync().then((sync) => {
    if (sync) scheduleSave(localKey(saved.repo), (keepalive) => upload(saved, keepalive))
    else writeLocal(saved, false)
  })
}

export function clearPortfolio(repo: string) {
  cancelSave(localKey(repo))
  writeItem(localKey(repo), null)
  void canSync().then((sync) => sync && deleteSaved(savedPath(repo)))
}

/** 화면 오른쪽의 미리보기와 복사 버튼이 쓰는 마크다운이에요. 항목은 왼쪽에서 정한 순서대로 이어 붙여요. */
export function toMarkdown(name: string, sections: PortfolioSection[]): string {
  return [`# ${name}`, ...sections.map((section) => `## ${section.title}\n\n${section.content.trim()}`)].join('\n\n') + '\n'
}
