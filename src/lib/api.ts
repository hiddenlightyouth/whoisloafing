import type { AnalyzeRequest, ChatEvent, ChatSnapshot, DeepReport, DeepSection } from '../../shared/types'
import { authFetch, authHeaders } from './auth'
import { apiUrl, ownerHeaders, readResult } from './http'
import { getLang, messages, pick, type Lang } from './i18n'
import { getModel } from './usage'

export interface ServerConfig {
  /** 채팅 저장과 공유 기능이 켜져 있는지 */
  storage: boolean
  /** 서버에 심층 분석 API가 있는지. 예전 서버에는 없어서, 그때는 앱의 사이드바에서 심층 분석을 숨겨요. */
  deep: boolean
  /** 서버에 탐색 API가 있는지. 없으면 앱의 새 분석 화면 아래에 탐색 목록을 붙이지 않아요. */
  explore: boolean
  /** 서버에 관리자 API가 있는지. 없으면 앱의 관리자 화면에서 AI 사용량만 보여줘요. */
  admin: boolean
  /** 서버에 채팅 상단 고정 API가 있는지. 없으면 내 작업의 메뉴에서 고정을 숨겨요. */
  pin: boolean
  /** 서버가 평가와 버그 신고를 받는지. 없으면 평가를 묻지 않고 버그 신고 버튼도 숨겨요. */
  feedback: boolean
  /** 서버의 탐색에 연합 동아리와 커뮤니티 목록이 있는지. 없으면 탐색을 갈래로 나누지 않고 GitHub 목록만 보여줘요. */
  clubs: boolean
  /** GitHub 로그인에 쓰는 공개 값. 서버가 GitHub 로그인을 켜 두지 않았으면 null이에요. */
  githubClientId: string | null
  /** 카카오 로그인에 쓰는 공개 값. 서버가 카카오 로그인을 켜 두지 않았으면 null이에요. */
  kakaoClientId: string | null
  /** 앱에서 시작한 계정 연결을 브라우저에서 마무리하는 API가 서버에 있는지. 없으면 앱의 내 정보에서 연결 버튼을 숨겨요. */
  socialAppLink: boolean
  /** 서버에 소셜 계정 연결 해제 API가 있는지. 없으면 내 정보에서 해제 버튼을 숨겨요. */
  socialUnlink: boolean
  /** 서버에 회원 탈퇴 API가 있는지. 없으면 내 정보에서 회원 탈퇴를 숨겨요. */
  withdraw: boolean
  /** 서버의 심층 분석에 기술 스택 탭이 있는지. 없으면 그 탭을 숨겨요. */
  deepStack: boolean
  /** 서버에 포트폴리오 만들기 API가 있는지. 없으면 앱의 사이드바에서 포트폴리오 만들기를 숨겨요. */
  portfolio: boolean
  /** 서버에 이력서 만들기 API가 있는지. 없으면 앱의 사이드바에서 이력서 만들기를 숨겨요. */
  resume: boolean
  /** 서버가 주간 사용량과 요금제를 다루는지. 없으면 시작 창에서 사용량을 보여주지 않아요. */
  usage: boolean
}

/** 서버가 어떤 기능을 지원하는지 물어봐요. */
export async function fetchConfig(): Promise<ServerConfig> {
  try {
    const result = await readResult<Partial<ServerConfig>>(await fetch(apiUrl('/config')))
    return {
      storage: result.ok && result.data?.storage === true,
      deep: result.ok && result.data?.deep === true,
      explore: result.ok && result.data?.explore === true,
      admin: result.ok && result.data?.admin === true,
      pin: result.ok && result.data?.pin === true,
      feedback: result.ok && result.data?.feedback === true,
      clubs: result.ok && result.data?.clubs === true,
      githubClientId: (result.ok && result.data?.githubClientId) || null,
      kakaoClientId: (result.ok && result.data?.kakaoClientId) || null,
      socialAppLink: result.ok && result.data?.socialAppLink === true,
      socialUnlink: result.ok && result.data?.socialUnlink === true,
      withdraw: result.ok && result.data?.withdraw === true,
      deepStack: result.ok && result.data?.deepStack === true,
      portfolio: result.ok && result.data?.portfolio === true,
      resume: result.ok && result.data?.resume === true,
      usage: result.ok && result.data?.usage === true,
    }
  } catch {
    return { storage: false, deep: false, explore: false, admin: false, pin: false, feedback: false, clubs: false, githubClientId: null, kakaoClientId: null, socialAppLink: false, socialUnlink: false, withdraw: false, deepStack: false, portfolio: false, resume: false, usage: false }
  }
}

let configOnce: Promise<ServerConfig> | null = null

/** 서버가 지원하는 기능을 한 번만 물어보고 나눠 써요. 로그인 화면과 내 정보처럼 따로 뜨는 화면에서 써요. */
export function loadConfig(): Promise<ServerConfig> {
  configOnce ??= fetchConfig()
  return configOnce
}

/** popular와 rising은 GitHub 전체에서 고른 레포, clubs는 IT 연합 동아리와 커뮤니티의 레포예요. */
export type ExploreKind = 'popular' | 'rising' | 'clubs'

/** 탐색 화면에 보여줄 레포 하나 */
export interface ExploreRepo {
  /** 소유자/레포 */
  repo: string
  description?: string
  language?: string
  stars: number
  avatarUrl?: string
  /** 어느 동아리나 커뮤니티의 레포인지. clubs 목록에서만 와요. */
  club?: string
  /** 학교마다 조직이 따로 있는 동아리에서, 이 레포가 어느 학교 것인지. 그런 동아리의 레포에만 와요. */
  group?: string
  /** 마지막으로 푸시한 때. clubs 목록에서만 와요. */
  pushedAt?: string
}

/** GitHub에서 인기 있는 공개 레포 목록을 받아요. 받지 못하면 null을 돌려줘요. */
export async function fetchExplore(kind: ExploreKind, lang: Lang = getLang()): Promise<ExploreRepo[] | null> {
  try {
    const result = await authFetch<ExploreRepo[]>(`/explore?kind=${kind}&lang=${lang}`)
    return result.ok ? result.data : null
  } catch {
    return null
  }
}

export const DEEP_ERRORS = messages<Record<string, string>>({
  ko: {
    C003: '레포 주소가 올바르지 않아요.',
    C4044: '찾을 수 없는 레포예요. 주소를 다시 확인해 주세요.',
    C4032: '비공개 레포는 분석할 수 없어요.',
    C4033: '서버가 이 레포에 접근할 수 없어요. 레포의 조직이 접근을 제한하고 있을 수 있어요.',
    C429: '요청이 너무 많아요. 잠시 뒤에 다시 시도해 주세요.',
    C4291: '이번 주 사용량을 모두 썼어요. 월요일 0시에 다시 채워져요.',
    C004: '이 모델은 아직 준비 중이에요. Claude로 다시 시작해 주세요.',
    failed: '분석하지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
    network: '서버와 연결하지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
  },
  en: {
    C003: 'The repository link is invalid.',
    C4044: "This repository can't be found. Please check the link.",
    C4032: "Private repositories can't be analyzed.",
    C4033: "The server can't access this repository. Its organization may be restricting access.",
    C429: 'Too many requests. Please try again in a moment.',
    C4291: "You've used up this week's usage. It refills on Monday at midnight (KST).",
    C004: "This model isn't ready yet. Please start again with Claude.",
    failed: "Couldn't analyze it. Please try again in a moment.",
    network: "Couldn't reach the server. Please try again in a moment.",
  },
})

/** 심층 분석의 탭 하나를 받아요. 로그인해야 받을 수 있어요. 실패하면 화면에 보여줄 안내를 돌려줘요. */
export async function fetchDeepReport(
  repo: string,
  section: DeepSection | 'people',
  /** 받아 둔 결과의 revision. 넘기면 그 뒤로 푸시가 없을 때 서버가 다시 분석하지 않아요. */
  since?: string,
): Promise<{ report: DeepReport } | { error: string }> {
  try {
    const query = `url=${encodeURIComponent(repo)}&lang=${getLang()}&model=${getModel()}${since ? `&since=${encodeURIComponent(since)}` : ''}`
    const result = await authFetch<DeepReport>(`/deep/${section}?${query}`)
    if (result.ok && result.data) return { report: result.data }
    return { error: (result.code && pick(DEEP_ERRORS)[result.code]) || pick(DEEP_ERRORS).failed }
  } catch {
    return { error: pick(DEEP_ERRORS).network }
  }
}

/** 저장된 채팅을 불러와요. 없거나 볼 수 없는 채팅이면 null을 돌려줘요. */
export async function fetchChat(id: string): Promise<ChatSnapshot | null> {
  const res = await fetch(apiUrl(`/chats/${id}`), { headers: { ...ownerHeaders(), ...(await authHeaders()) } })
  const result = await readResult<ChatSnapshot>(res)
  return result.ok ? result.data : null
}

/** 채팅 관리 요청은 로그인해야 쓸 수 있어요. 연결이 끊기면 false를 돌려줘요. */
async function manageChat(path: string, method: 'POST' | 'DELETE'): Promise<boolean> {
  try {
    return (await authFetch<null>(path, { method, headers: ownerHeaders() })).ok
  } catch {
    return false
  }
}

/** 채팅을 내 계정에 저장하고 링크를 아는 누구나 볼 수 있게 해요. */
export const shareChat = (id: string) => manageChat(`/chats/${id}/share`, 'POST')

/** 공유를 취소해요. 다시 나만 열고 이어서 분석할 수 있어요. */
export const unshareChat = (id: string) => manageChat(`/chats/${id}/share`, 'DELETE')

/** 채팅을 내 작업 맨 위에 고정하거나 고정을 풀어요. */
export const pinChat = (id: string, pinned: boolean) => manageChat(`/chats/${id}/pin`, pinned ? 'POST' : 'DELETE')

let pinSupport: Promise<boolean> | null = null

/** 서버가 상단 고정을 지원하는지. 한 번만 물어봐요. */
export function canPinChats(): Promise<boolean> {
  pinSupport ??= fetchConfig().then((config) => config.pin)
  return pinSupport
}

/** 채팅 하나의 고정을 바꾼 뒤의 목록 순서예요. 서버처럼 고정한 채팅이 먼저, 새로 고정한 것이 맨 위, 나머지는 최근에 작업한 순서로 둬요. */
export function reorderPinned<T extends { id: string; pinned?: boolean; updatedAt: string }>(chats: T[], id: string, pinned: boolean): T[] {
  const target = chats.find((chat) => chat.id === id)
  if (!target) return chats
  const rest = chats.filter((chat) => chat.id !== id)
  const changed = { ...target, pinned }
  if (pinned) return [changed, ...rest]
  const loose = [...rest.filter((chat) => !chat.pinned), changed].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return [...rest.filter((chat) => chat.pinned), ...loose]
}

/** 채팅을 지워요. 되돌릴 수 없어요. */
export const deleteChat = (id: string) => manageChat(`/chats/${id}`, 'DELETE')

/** 서버가 SSE로 흘려보내는 분석 메시지를 하나씩 받아서 넘겨줘요. */
export async function streamAnalysis(
  request: AnalyzeRequest,
  onEvent: (event: ChatEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(apiUrl('/analyze'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...ownerHeaders(), ...(await authHeaders()) },
    // 시간대별 통계를 사용자의 시간대로 보여주려고 함께 보내요.
    // 고른 모델도 같이 보내요. 서버가 사용량을 기록할 때 써요.
    body: JSON.stringify({ ...request, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, lang: getLang(), model: getModel() }),
    signal,
  })
  if (!res.ok || !res.body) throw new Error(`분석 요청에 실패했어요. (${res.status})`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let boundary: number
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      for (const line of chunk.split('\n')) {
        if (line.startsWith('data:')) onEvent(JSON.parse(line.slice(5).trimStart()) as ChatEvent)
      }
    }
  }
}
