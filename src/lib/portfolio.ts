import { authFetch } from './auth'
import { DEEP_ERRORS } from './api'

/** 포트폴리오에 넣을 수 있는 항목. 서버의 PortfolioSection과 맞춰요. */
export type PortfolioKey = 'intro' | 'period' | 'team' | 'stack' | 'role' | 'features' | 'trouble' | 'result'

export const PORTFOLIO_SECTIONS: { key: PortfolioKey; title: string; hint: string }[] = [
  { key: 'intro', title: '프로젝트 소개', hint: '어떤 고민에서 시작했고 무엇을 만들었는지' },
  { key: 'period', title: '개발 기간', hint: '언제부터 언제까지, 얼마나 작업했는지' },
  { key: 'team', title: '팀 구성', hint: '분야별로 누가 참여했는지' },
  { key: 'stack', title: '기술 스택', hint: '분야별로 쓴 기술' },
  { key: 'role', title: '맡은 역할', hint: '내가 맡아서 한 일' },
  { key: 'features', title: '주요 기능', hint: '서비스의 핵심 기능' },
  { key: 'trouble', title: '문제 해결 경험', hint: '부딪힌 문제와 해결한 방법' },
  { key: 'result', title: '성과와 배운 점', hint: '확인되는 성과와 익힌 것' },
]

export const DEFAULT_SECTIONS: PortfolioKey[] = ['intro', 'team', 'stack', 'role']

/** 항목을 고칠 때 고르는 요청. 서버의 PortfolioRevision과 맞춰요. */
export type RevisionKey = 'shorter' | 'longer' | 'numbers' | 'formal' | 'list' | 'story' | 'rewrite'

export const REVISIONS: { key: RevisionKey; label: string }[] = [
  { key: 'shorter', label: '더 짧게' },
  { key: 'longer', label: '더 자세하게' },
  { key: 'numbers', label: '수치를 넣어서' },
  { key: 'formal', label: '더 전문적인 말투로' },
  { key: 'list', label: '목록으로 정리' },
  { key: 'story', label: '문장으로 풀어서' },
  { key: 'rewrite', label: '다시 쓰기' },
]

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

/** 이 기기에 저장해 두는 포트폴리오 하나. 다음에 같은 레포를 열면 이어서 고쳐요. */
export interface SavedPortfolio {
  repo: string
  sections: PortfolioSection[]
  plan: string
  person: string | null
  createdAt: string
}

const ERRORS: Record<string, string> = {
  ...DEEP_ERRORS,
  C5031: '글을 쓰지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
}

type Outcome<T> = { data: T } | { error: string }

async function call<T>(path: string, init?: RequestInit): Promise<Outcome<T>> {
  try {
    const result = await authFetch<T>(path, init)
    if (result.ok && result.data) return { data: result.data }
    return { error: (result.code && ERRORS[result.code]) || '포트폴리오를 만들지 못했어요. 잠시 뒤에 다시 시도해 주세요.' }
  } catch {
    return { error: '서버와 연결하지 못했어요. 잠시 뒤에 다시 시도해 주세요.' }
  }
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export function fetchPortfolioPeople(repo: string) {
  return call<PortfolioPerson[]>(`/portfolio/people?url=${encodeURIComponent(repo)}`)
}

export function createPortfolio(repo: string, sections: PortfolioKey[], plan: string, person: string | null) {
  return call<{ repo: string; sections: PortfolioSection[] }>('/portfolio', json({ url: repo, sections, plan: plan || null, person }))
}

export function revisePortfolio(repo: string, section: PortfolioKey, revision: RevisionKey, content: string, plan: string, person: string | null) {
  return call<PortfolioSection>('/portfolio/revise', json({ url: repo, section, revision, content, plan: plan || null, person }))
}

const SAVED_PREFIX = 'whoisloafing:portfolio:v1:'

export function readPortfolio(repo: string): SavedPortfolio | null {
  try {
    const raw = localStorage.getItem(`${SAVED_PREFIX}${repo.toLowerCase()}`)
    return raw ? (JSON.parse(raw) as SavedPortfolio) : null
  } catch {
    return null
  }
}

export function writePortfolio(saved: SavedPortfolio) {
  try {
    localStorage.setItem(`${SAVED_PREFIX}${saved.repo.toLowerCase()}`, JSON.stringify(saved))
  } catch {
    // 저장 공간이 모자라면 저장하지 않아요. 화면에는 그대로 보여요.
  }
}

export function clearPortfolio(repo: string) {
  try {
    localStorage.removeItem(`${SAVED_PREFIX}${repo.toLowerCase()}`)
  } catch {
    return
  }
}

/** 화면 오른쪽의 미리보기와 복사 버튼이 쓰는 마크다운이에요. 항목은 왼쪽에서 정한 순서대로 이어 붙여요. */
export function toMarkdown(name: string, sections: PortfolioSection[]): string {
  return [`# ${name}`, ...sections.map((section) => `## ${section.title}\n\n${section.content.trim()}`)].join('\n\n') + '\n'
}
