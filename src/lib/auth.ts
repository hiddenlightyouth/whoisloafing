import { apiUrl, ownerHeaders, readResult, type ApiResult } from './http'
import { getLang, messages, pick } from './i18n'
import { readJson, writeItem, writeJson } from './storage'
import { createStore, useStore } from './store'

const TOKEN_STORAGE = 'whoisloafing:auth'
const ME_STORAGE = 'whoisloafing:me'
const REFRESH_MARGIN_MS = 30_000

export interface Tokens {
  accessToken: string
  refreshToken: string
}

export interface Me {
  id: number
  email: string
  name: string
  role: string
  registeredAt: string | null
  /** 연결된 GitHub 아이디. 연결하지 않았으면 없어요. */
  githubLogin?: string | null
  /** GitHub 계정, 카카오 계정이 연결되어 있는지 */
  github?: boolean
  kakao?: boolean
  /** 이메일과 비밀번호로 로그인할 수 있는지. 소셜 로그인으로 가입했으면 false예요. */
  passwordSet?: boolean
}

export interface AuthState {
  tokens: Tokens | null
  me: Me | null
}

export interface Slice<T> {
  items: T[]
  page: number
  size: number
  hasNext: boolean
}

export interface DeviceSession {
  sessionId: string
  deviceName: string | null
  userAgent: string | null
  createdAt: string
  lastUsedAt: string
  current: boolean
}

export interface LoginRecord {
  id: number
  deviceName: string | null
  userAgent: string | null
  ipAddress: string | null
  loggedInAt: string
  current: boolean
}

export interface ChatSummary {
  id: string
  repoUrl: string
  repoName: string
  shared: boolean
  /** 내 작업 맨 위에 고정했는지. 예전 서버는 이 값을 보내지 않아요. */
  pinned?: boolean
  preview: string | null
  lastSender: 'user' | 'bot' | null
  messageCount: number
  createdAt: string
  updatedAt: string
}

export type AuthOutcome = { ok: true } | { ok: false; message: string }

const ERROR_MESSAGES = messages<Record<string, string>>({
  ko: {
    C4012: '비밀번호가 맞지 않아요.',
    C4014: '로그인 시간이 지났어요. 처음부터 다시 시도해 주세요.',
    C4015: '계정을 확인하지 못했어요. 처음부터 다시 시도해 주세요.',
    C4017: '연결 요청 시간이 지났어요. 앱에서 연결을 다시 눌러 주세요.',
    C4016: 'GitHub 계정에 인증된 이메일이 없어요. GitHub에서 이메일을 인증한 뒤에 다시 시도해 주세요.',
    C4045: '지금은 이 방법으로 로그인할 수 없어요.',
    C4092: '이미 이메일로 가입한 계정이에요. 이메일로 로그인한 뒤, 내 정보에서 계정을 연결해 주세요.',
    C4093: '이미 다른 계정에 연결되어 있어요.',
    C4094: '로그인할 방법이 하나는 남아 있어야 해서 해제할 수 없어요.',
    C4034: '정지된 계정이에요. 관리자에게 문의해 주세요.',
    C4041: '가입하지 않은 이메일이에요.',
    C4091: '이미 가입한 이메일이에요.',
    C002: '입력한 내용을 다시 확인해 주세요.',
    network: '서버와 연결하지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
    unknown: '문제가 생겼어요. 잠시 뒤에 다시 시도해 주세요.',
  },
  en: {
    C4012: 'The password is incorrect.',
    C4014: 'The sign-in request expired. Please start over.',
    C4015: "We couldn't verify the account. Please start over.",
    C4017: 'The connection request expired. Click Connect in the app again.',
    C4016: 'Your GitHub account has no verified email. Verify an email on GitHub and try again.',
    C4045: "You can't sign in this way right now.",
    C4092: 'This email already has an account. Sign in with your email, then connect this account from Account settings.',
    C4093: "It's already connected to another account.",
    C4094: "You need at least one way to sign in, so this can't be disconnected.",
    C4034: 'This account is suspended. Please contact an administrator.',
    C4041: "There's no account with this email.",
    C4091: 'This email is already registered.',
    C002: 'Please check what you entered.',
    network: "Couldn't reach the server. Please try again in a moment.",
    unknown: 'Something went wrong. Please try again in a moment.',
  },
})

const NETWORK_MESSAGE = () => pick(ERROR_MESSAGES).network
const UNKNOWN_MESSAGE = () => pick(ERROR_MESSAGES).unknown

const readSaved = <T,>(key: string) => readJson<T | null>(key, null)

const writeSaved = (key: string, value: unknown) => (value === null ? writeItem(key, null) : writeJson(key, value))

function readTokens(): Tokens | null {
  const tokens = readSaved<Tokens>(TOKEN_STORAGE)
  return tokens && typeof tokens.accessToken === 'string' && typeof tokens.refreshToken === 'string' ? tokens : null
}

const auth = createStore<AuthState>({ tokens: readTokens(), me: readTokens() ? readSaved<Me>(ME_STORAGE) : null })

function setState(next: AuthState) {
  writeSaved(TOKEN_STORAGE, next.tokens)
  writeSaved(ME_STORAGE, next.me)
  auth.set(next)
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== TOKEN_STORAGE && event.key !== ME_STORAGE) return
    const tokens = readTokens()
    auth.set({ tokens, me: tokens ? readSaved<Me>(ME_STORAGE) : null })
  })
}

export function useAuth(): AuthState {
  return useStore(auth)
}

/** 지금 로그인해 있는지. 화면 바깥(저장소)에서 쓸 때 봐요. */
export const isSignedIn = () => auth.get().tokens !== null

function clearAuth() {
  if (auth.get().tokens || auth.get().me) setState({ tokens: null, me: null })
}

function expiresAt(token: string): number | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const exp = (JSON.parse(atob(payload)) as { exp?: number }).exp
    return typeof exp === 'number' ? exp * 1000 : null
  } catch {
    return null
  }
}

const isFresh = (token: string) => {
  const exp = expiresAt(token)
  return exp === null || exp - Date.now() > REFRESH_MARGIN_MS
}

let refreshing: Promise<boolean> | null = null

function reissue(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const latest = readTokens()
      if (latest && latest.accessToken !== auth.get().tokens?.accessToken && isFresh(latest.accessToken)) {
        setState({ ...auth.get(), tokens: latest })
        return true
      }
      const refreshToken = latest?.refreshToken ?? auth.get().tokens?.refreshToken
      if (!refreshToken) return false
      const res = await fetch(apiUrl('/auth/reissue'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      const result = await readResult<Tokens>(res)
      if (result.ok && result.data) {
        setState({ ...auth.get(), tokens: result.data })
        return true
      }
      if (res.status === 400 || res.status === 401) clearAuth()
      return false
    } catch {
      return false
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

async function freshAccessToken(): Promise<string | null> {
  const tokens = auth.get().tokens
  if (!tokens) return null
  if (!isFresh(tokens.accessToken)) await reissue()
  return auth.get().tokens?.accessToken ?? null
}

export async function authHeaders(): Promise<Record<string, string>> {
  const token = await freshAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function authFetch<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const send = async () =>
    fetch(apiUrl(path), { ...init, headers: { ...(init.headers as Record<string, string>), ...(await authHeaders()) } })
  let res = await send()
  if (res.status === 401 && auth.get().tokens && (await reissue())) res = await send()
  return readResult<T>(res)
}

const messageOf = (code: string | null) => (code && pick(ERROR_MESSAGES)[code]) || UNKNOWN_MESSAGE()

export function describeDevice(userAgent: string | null | undefined): string {
  const ua = userAgent ?? ''
  const en = getLang() === 'en'
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Whale\//.test(ua)
      ? 'Whale'
      : /SamsungBrowser/.test(ua)
        ? (en ? 'Samsung Internet' : '삼성 인터넷')
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Chrome\//.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : en ? 'Unknown browser' : '알 수 없는 브라우저'
  const os = /iPhone|iPad|iPod/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac OS X/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : ''
  if (/WhoIsLoafingApp\//.test(ua)) return en ? (os ? `${os} app` : 'App') : os ? `${os} 앱` : '앱'
  return os ? (en ? `${browser} on ${os}` : `${os}의 ${browser}`) : browser
}

async function startSession(tokens: Tokens): Promise<void> {
  const headers = { Authorization: `Bearer ${tokens.accessToken}` }
  const [me] = await Promise.all([
    fetch(apiUrl('/users/me'), { headers })
      .then((res) => readResult<Me>(res))
      .then((result) => result.data)
      .catch(() => null),
    fetch(apiUrl('/users/me/chats/claim'), { method: 'POST', headers: { ...headers, ...ownerHeaders() } }).catch(() => null),
  ])
  setState({ tokens, me })
}

async function submitCredentials(path: string, body: Record<string, string>): Promise<AuthOutcome> {
  try {
    const res = await fetch(apiUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, deviceName: describeDevice(navigator.userAgent) }),
    })
    const result = await readResult<Tokens>(res)
    if (!result.ok || !result.data) return { ok: false, message: messageOf(result.code) }
    await startSession(result.data)
    return { ok: true }
  } catch {
    return { ok: false, message: NETWORK_MESSAGE() }
  }
}

export const signIn = (email: string, password: string) => submitCredentials('/auth/signin', { email, password })

export const signUp = (email: string, name: string, password: string) =>
  submitCredentials('/auth/signup', { email, name, password })

/** 소셜 서비스(GitHub, 카카오)에서 받은 코드로 로그인해요. 처음이면 가입까지 돼요. */
export const signInSocial = (provider: string, code: string, redirectUri: string) =>
  submitCredentials(`/auth/social/${provider}`, { code, redirectUri })

/** 로그인한 내 계정에 소셜 계정을 연결해요. */
export async function linkSocial(provider: string, code: string, redirectUri: string): Promise<AuthOutcome> {
  try {
    const result = await authFetch<null>(`/auth/social/${provider}/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirectUri }),
    })
    if (!result.ok) return { ok: false, message: messageOf(result.code) }
    await loadMe()
    return { ok: true }
  } catch {
    return { ok: false, message: NETWORK_MESSAGE() }
  }
}

/** 내 계정에서 소셜 계정 연결을 해제해요. */
export async function unlinkSocial(provider: string): Promise<AuthOutcome> {
  try {
    const result = await authFetch<null>(`/auth/social/${provider}/link`, { method: 'DELETE' })
    if (!result.ok) return { ok: false, message: messageOf(result.code) }
    await loadMe()
    return { ok: true }
  } catch {
    return { ok: false, message: NETWORK_MESSAGE() }
  }
}

/** 회원 탈퇴해요. 서버에서 계정과 채팅을 모두 지우고, 이 브라우저의 로그인도 지워요. */
export async function withdraw(): Promise<AuthOutcome> {
  try {
    const result = await authFetch<null>('/users/me', { method: 'DELETE' })
    if (!result.ok) return { ok: false, message: messageOf(result.code) }
    clearAuth()
    return { ok: true }
  } catch {
    return { ok: false, message: NETWORK_MESSAGE() }
  }
}

/** 앱에서, 브라우저로 넘겨줄 계정 연결용 일회용 값을 받아요. 브라우저는 이 값으로 어느 계정에 연결할지 알아요. */
export async function createSocialLinkTicket(provider: string): Promise<string | null> {
  try {
    const result = await authFetch<{ ticket: string }>(`/auth/social/${provider}/link/ticket`, { method: 'POST' })
    return result.ok ? (result.data?.ticket ?? null) : null
  } catch {
    return null
  }
}

/** 일회용 값이 가리키는, 소셜 계정을 연결하려는 계정 */
export interface SocialLinkTarget {
  provider: string
  name: string
  email: string
}

export async function fetchSocialLinkTarget(ticket: string): Promise<SocialLinkTarget | null> {
  try {
    const result = await readResult<SocialLinkTarget>(await fetch(apiUrl(`/auth/social/link/ticket/${encodeURIComponent(ticket)}`)))
    return result.ok ? result.data : null
  } catch {
    return null
  }
}

/** 앱이 넘겨준 일회용 값으로, 브라우저에서 받은 소셜 계정을 그 계정에 연결해요. 브라우저의 로그인과는 상관없어요. */
export async function confirmSocialLink(provider: string, ticket: string, code: string, redirectUri: string): Promise<AuthOutcome> {
  try {
    const res = await fetch(apiUrl(`/auth/social/${provider}/link/confirm`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket, code, redirectUri }),
    })
    const result = await readResult<null>(res)
    return result.ok ? { ok: true } : { ok: false, message: messageOf(result.code) }
  } catch {
    return { ok: false, message: NETWORK_MESSAGE() }
  }
}

/** 브라우저에서 로그인한 채로, 앱에 로그인을 넘겨줄 일회용 코드를 받아요. */
export async function createAppLoginCode(challenge: string): Promise<string | null> {
  try {
    const result = await authFetch<{ code: string }>('/auth/app/code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge }),
    })
    return result.ok ? (result.data?.code ?? null) : null
  } catch {
    return null
  }
}

/** 앱에서, 브라우저가 넘겨준 일회용 코드로 로그인해요. 앱의 세션은 브라우저와 따로 만들어져요. */
export const signInWithAppCode = (code: string, verifier: string) => submitCredentials('/auth/app/token', { code, verifier })

export async function signOut(): Promise<void> {
  if (auth.get().tokens) {
    const headers = await authHeaders()
    await fetch(apiUrl('/auth/logout'), { method: 'POST', headers }).catch(() => null)
  }
  clearAuth()
}

/** 이 브라우저에서 로그인하지 않고 만든 채팅을 내 계정에 연결해요. */
export async function claimChats(): Promise<void> {
  if (!auth.get().tokens) return
  await authFetch('/users/me/chats/claim', { method: 'POST', headers: ownerHeaders() }).catch(() => null)
}

export async function loadMe(): Promise<Me | null> {
  if (!auth.get().tokens) return null
  try {
    const result = await authFetch<Me>('/users/me')
    if (result.ok && result.data && auth.get().tokens) setState({ ...auth.get(), me: result.data })
    return result.data
  } catch {
    return auth.get().me
  }
}

async function fetchList<T>(path: string): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const result = await authFetch<T>(path)
    return result.ok && result.data ? { ok: true, data: result.data } : { ok: false, message: messageOf(result.code) }
  } catch {
    return { ok: false, message: NETWORK_MESSAGE() }
  }
}

export const fetchSessions = () => fetchList<DeviceSession[]>('/auth/sessions')

export const fetchLoginHistory = (page: number) => fetchList<Slice<LoginRecord>>(`/users/me/login-history?page=${page}&size=20`)

export const isAdmin = (me: Me | null) => me?.role === 'ADMIN'

export const fetchMyChats = (page: number) => fetchList<Slice<ChatSummary>>(`/users/me/chats?page=${page}&size=20`)

export async function revokeSession(sessionId: string): Promise<boolean> {
  try {
    return (await authFetch<null>(`/auth/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })).ok
  } catch {
    return false
  }
}
