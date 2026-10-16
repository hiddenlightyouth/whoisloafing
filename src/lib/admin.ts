import { authFetch, type Slice } from './auth'
import { getLang, messages, pick } from './i18n'

export type Result<T> = { ok: true; data: T } | { ok: false; message: string }

export type DeviceKind = 'APP' | 'MOBILE' | 'DESKTOP' | 'UNKNOWN'

const DEVICES = messages<Record<DeviceKind, string>>({
  ko: { APP: '앱', MOBILE: '모바일', DESKTOP: 'PC', UNKNOWN: '알 수 없음' },
  en: { APP: 'App', MOBILE: 'Mobile', DESKTOP: 'Desktop', UNKNOWN: 'Unknown' },
})

export const deviceLabels = () => pick(DEVICES)

export interface AdminOverview {
  users: { total: number; today: number; week: number; admins: number; suspended: number }
  /** 그 기기로 한 번이라도 로그인한 회원 수예요. 한 회원이 여러 곳에 들어갈 수 있어요. */
  devices: { app: number; mobile: number; desktop: number }
  chats: { total: number; today: number; week: number; shared: number; anonymous: number; messages: number }
  daily: { day: string; signups: number; chats: number }[]
  topRepos: { repoName: string; chats: number }[]
}

export interface AdminUser {
  id: number
  email: string
  name: string
  role: 'USER' | 'ADMIN'
  /** 요금제. 예전 서버에는 없어요. */
  plan?: 'FREE' | 'LITE' | 'PRO'
  suspended: boolean
  suspendedAt: string | null
  registeredAt: string | null
  lastLoginAt: string | null
  loginCount: number
  /** 앱으로 로그인한 적이 있는지. 앱을 깔았는지 보는 값이에요. */
  usesApp: boolean
  usesMobile: boolean
  usesDesktop: boolean
  chatCount: number
}

export interface AdminSession {
  sessionId: string
  deviceName: string | null
  device: DeviceKind
  userAgent: string | null
  createdAt: string
  lastUsedAt: string
}

export interface AdminLogin {
  id: number
  deviceName: string | null
  device: DeviceKind
  userAgent: string | null
  ipAddress: string | null
  loggedInAt: string
}

export interface AdminChat {
  id: string
  repoUrl: string
  repoName: string
  shared: boolean
  sharedAt: string | null
  userId: number | null
  userEmail: string | null
  userName: string | null
  messageCount: number
  createdAt: string
  updatedAt: string
}

export interface AdminUserDetail {
  user: AdminUser
  sessions: AdminSession[]
  logins: AdminLogin[]
  chats: AdminChat[]
}

export type AdminUserFilter = 'ALL' | 'ADMIN' | 'SUSPENDED' | 'APP' | 'MOBILE' | 'DESKTOP'
export type AdminChatFilter = 'ALL' | 'SHARED' | 'ANONYMOUS'

/** AI 사용량 한 줄. 날짜, 목적, 모델별로 묶여서 와요. */
export interface AiUsageRow {
  day: string
  purpose: string
  model: string
  calls: number
  failedCalls: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

/** AI 호출 한 번의 기록. 프롬프트와 응답 전문은 오지 않아요. */
export interface AiCall {
  id: number
  chatId: string | null
  purpose: string
  label: string | null
  model: string
  status: 'OK' | 'ERROR'
  error: string | null
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  durationMs: number
  createdAt: string
}

/** AI 호출 한 번의 전문이에요. 넣은 프롬프트와 받은 응답이 그대로 들어 있어요. */
export interface AiCallDetail extends AiCall {
  systemPrompt: string
  userPrompt: string
  response: string | null
}

/** 사용자가 보낸 평가나 버그 신고 하나 */
export interface AdminFeedback {
  id: number
  kind: 'RATING' | 'BUG'
  rating: 'GOOD' | 'BAD' | null
  comment: string | null
  chatId: string | null
  page: string | null
  userId: number | null
  userEmail: string | null
  userName: string | null
  device: DeviceKind
  createdAt: string
}

export interface FeedbackSummary {
  good: number
  bad: number
  bugs: number
}

const MESSAGES = messages<Record<string, string>>({
  ko: {
    C404: '없는 기록이에요. 목록을 새로 받아 주세요.',
    C403: '관리자 계정만 할 수 있어요.',
    C4035: '내 계정에는 할 수 없는 작업이에요.',
    C4041: '없는 회원이에요. 목록을 새로 받아 주세요.',
    C4042: '이미 로그아웃된 기기예요.',
    C4043: '없는 채팅이에요. 목록을 새로 받아 주세요.',
    network: '서버와 연결하지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
    unknown: '문제가 생겼어요. 잠시 뒤에 다시 시도해 주세요.',
    unsupported: '서버가 아직 이 기능을 지원하지 않아요.',
  },
  en: {
    C404: 'This record no longer exists. Please reload the list.',
    C403: 'Only admin accounts can do this.',
    C4035: "You can't do this to your own account.",
    C4041: 'This member no longer exists. Please reload the list.',
    C4042: 'This device is already signed out.',
    C4043: 'This chat no longer exists. Please reload the list.',
    network: "Couldn't connect to the server. Please try again in a moment.",
    unknown: 'Something went wrong. Please try again in a moment.',
    unsupported: "The server doesn't support this feature yet.",
  },
})

async function request<T>(path: string, init?: RequestInit): Promise<Result<T>> {
  try {
    const result = await authFetch<T>(path, init)
    if (result.ok) return { ok: true, data: result.data as T }
    // 관리자 API가 아직 없는 서버는 없는 주소라고 답해요.
    if (result.status === 404 && !result.code) return { ok: false, message: pick(MESSAGES).unsupported }
    return { ok: false, message: (result.code && pick(MESSAGES)[result.code]) || pick(MESSAGES).unknown }
  } catch {
    return { ok: false, message: pick(MESSAGES).network }
  }
}

const send = (path: string, method: string, body?: unknown) =>
  request<null>(path, body === undefined ? { method } : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

const listQuery = (query: string, filter: string, page: number) => {
  const params = new URLSearchParams({ filter, page: String(page), size: '20' })
  if (query.trim()) params.set('query', query.trim())
  return params.toString()
}

export const fetchOverview = (days: number) => request<AdminOverview>(`/admin/overview?days=${days}`)

export const fetchAdminUsers = (query: string, filter: AdminUserFilter, page: number) =>
  request<Slice<AdminUser>>(`/admin/users?${listQuery(query, filter, page)}`)

export const fetchAdminUser = (id: number) => request<AdminUserDetail>(`/admin/users/${id}`)

export const changeUserRole = (id: number, role: 'USER' | 'ADMIN') => send(`/admin/users/${id}/role`, 'PATCH', { role })

export const changeUserPlan = (id: number, plan: 'FREE' | 'LITE' | 'PRO') => send(`/admin/users/${id}/plan`, 'PATCH', { plan })

export const suspendUser = (id: number) => send(`/admin/users/${id}/suspension`, 'POST')

export const unsuspendUser = (id: number) => send(`/admin/users/${id}/suspension`, 'DELETE')

export const revokeUserSessions = (id: number) => send(`/admin/users/${id}/sessions`, 'DELETE')

export const revokeUserSession = (id: number, sessionId: string) => send(`/admin/users/${id}/sessions/${encodeURIComponent(sessionId)}`, 'DELETE')

export const deleteUser = (id: number) => send(`/admin/users/${id}`, 'DELETE')

export const fetchAdminChats = (query: string, filter: AdminChatFilter, page: number) =>
  request<Slice<AdminChat>>(`/admin/chats?${listQuery(query, filter, page)}`)

export const unshareAdminChat = (id: string) => send(`/admin/chats/${id}/share`, 'DELETE')

export const deleteAdminChat = (id: string) => send(`/admin/chats/${id}`, 'DELETE')

export const fetchAdminFeedback = (kind: 'ALL' | 'RATING' | 'BUG', page: number) =>
  request<Slice<AdminFeedback>>(`/admin/feedback?page=${page}&size=20${kind === 'ALL' ? '' : `&kind=${kind}`}`)

export const fetchFeedbackSummary = () => request<FeedbackSummary>('/admin/feedback/summary')

/** from(YYYY-MM-DD)부터 오늘까지의 AI 사용량을 받아요. */
export const fetchAiUsage = (from: string) => request<AiUsageRow[]>(`/ai-usage/daily?from=${from}`)

export const fetchAiCalls = (failedOnly: boolean, page: number) =>
  request<Slice<AiCall>>(`/ai-usage/calls?page=${page}&size=20${failedOnly ? '&status=ERROR' : ''}`)

export const fetchAiCall = (id: number) => request<AiCallDetail>(`/ai-usage/calls/${id}`)

// 서버는 날짜를 한국 날짜로 묶어서, 화면도 한국 날짜로 기간을 세요.
const seoulDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })

/** 한국 기준 오늘 날짜(YYYY-MM-DD)예요. */
export const seoulToday = () => seoulDay.format(Date.now())

export function addDays(day: string, amount: number): string {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date + amount)).toISOString().slice(0, 10)
}

/** from부터 to까지의 날짜를 오래된 순서로 돌려줘요. 두 날짜도 들어가요. */
export function daysBetween(from: string, to: string): string[] {
  const days: string[] = []
  for (let day = from; day <= to && days.length < 4000; day = addDays(day, 1)) days.push(day)
  return days
}

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function dayLabel(day: string): string {
  const [, month, date] = day.split('-')
  if (getLang() === 'en') return `${EN_MONTHS[Number(month) - 1]} ${Number(date)}`
  return `${Number(month)}월 ${Number(date)}일`
}

export function monthLabel(month: string): string {
  const [year, value] = month.split('-')
  if (getLang() === 'en') return `${EN_MONTHS[Number(value) - 1]} ${year}`
  return `${year}년 ${Number(value)}월`
}
