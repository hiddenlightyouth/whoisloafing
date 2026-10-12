import { useSyncExternalStore } from 'react'
import { apiUrl, ownerHeaders, readResult, type ApiResult } from './http'

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
  preview: string | null
  lastSender: 'user' | 'bot' | null
  messageCount: number
  createdAt: string
  updatedAt: string
}

export type AuthOutcome = { ok: true } | { ok: false; message: string }

const ERROR_MESSAGES: Record<string, string> = {
  C4012: '비밀번호가 맞지 않아요.',
  C4014: '로그인 시간이 지났어요. 처음부터 다시 시도해 주세요.',
  C4041: '가입하지 않은 이메일이에요.',
  C4091: '이미 가입한 이메일이에요.',
  C002: '입력한 내용을 다시 확인해 주세요.',
}

const NETWORK_MESSAGE = '서버와 연결하지 못했어요. 잠시 뒤에 다시 시도해 주세요.'
const UNKNOWN_MESSAGE = '문제가 생겼어요. 잠시 뒤에 다시 시도해 주세요.'

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    return
  }
}

function readTokens(): Tokens | null {
  const tokens = readJson<Tokens>(TOKEN_STORAGE)
  return tokens && typeof tokens.accessToken === 'string' && typeof tokens.refreshToken === 'string' ? tokens : null
}

let state: AuthState = { tokens: readTokens(), me: readTokens() ? readJson<Me>(ME_STORAGE) : null }
const listeners = new Set<() => void>()

function setState(next: AuthState) {
  state = next
  writeJson(TOKEN_STORAGE, next.tokens)
  writeJson(ME_STORAGE, next.me)
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== TOKEN_STORAGE && event.key !== ME_STORAGE) return
    const tokens = readTokens()
    state = { tokens, me: tokens ? readJson<Me>(ME_STORAGE) : null }
    listeners.forEach((listener) => listener())
  })
}

export function useAuth(): AuthState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  )
}

export function clearAuth() {
  if (state.tokens || state.me) setState({ tokens: null, me: null })
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
      if (latest && latest.accessToken !== state.tokens?.accessToken && isFresh(latest.accessToken)) {
        setState({ ...state, tokens: latest })
        return true
      }
      const refreshToken = latest?.refreshToken ?? state.tokens?.refreshToken
      if (!refreshToken) return false
      const res = await fetch(apiUrl('/auth/reissue'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      const result = await readResult<Tokens>(res)
      if (result.ok && result.data) {
        setState({ ...state, tokens: result.data })
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
  const tokens = state.tokens
  if (!tokens) return null
  if (!isFresh(tokens.accessToken)) await reissue()
  return state.tokens?.accessToken ?? null
}

export async function authHeaders(): Promise<Record<string, string>> {
  const token = await freshAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function authFetch<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const send = async () =>
    fetch(apiUrl(path), { ...init, headers: { ...(init.headers as Record<string, string>), ...(await authHeaders()) } })
  let res = await send()
  if (res.status === 401 && state.tokens && (await reissue())) res = await send()
  return readResult<T>(res)
}

const messageOf = (code: string | null) => (code && ERROR_MESSAGES[code]) || UNKNOWN_MESSAGE

export function describeDevice(userAgent: string | null | undefined): string {
  const ua = userAgent ?? ''
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Whale\//.test(ua)
      ? 'Whale'
      : /SamsungBrowser/.test(ua)
        ? '삼성 인터넷'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Chrome\//.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : '알 수 없는 브라우저'
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
  if (/WhoIsLoafingApp\//.test(ua)) return os ? `${os} 앱` : '앱'
  return os ? `${os}의 ${browser}` : browser
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
    return { ok: false, message: NETWORK_MESSAGE }
  }
}

export const signIn = (email: string, password: string) => submitCredentials('/auth/signin', { email, password })

export const signUp = (email: string, name: string, password: string) =>
  submitCredentials('/auth/signup', { email, name, password })

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
  if (state.tokens) {
    const headers = await authHeaders()
    await fetch(apiUrl('/auth/logout'), { method: 'POST', headers }).catch(() => null)
  }
  clearAuth()
}

/** 이 브라우저에서 로그인하지 않고 만든 채팅을 내 계정에 연결해요. */
export async function claimChats(): Promise<void> {
  if (!state.tokens) return
  await authFetch('/users/me/chats/claim', { method: 'POST', headers: ownerHeaders() }).catch(() => null)
}

export async function loadMe(): Promise<Me | null> {
  if (!state.tokens) return null
  try {
    const result = await authFetch<Me>('/users/me')
    if (result.ok && result.data && state.tokens) setState({ ...state, me: result.data })
    return result.data
  } catch {
    return state.me
  }
}

async function fetchList<T>(path: string): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const result = await authFetch<T>(path)
    return result.ok && result.data ? { ok: true, data: result.data } : { ok: false, message: messageOf(result.code) }
  } catch {
    return { ok: false, message: NETWORK_MESSAGE }
  }
}

export const fetchSessions = () => fetchList<DeviceSession[]>('/auth/sessions')

export const fetchLoginHistory = (page: number) => fetchList<Slice<LoginRecord>>(`/users/me/login-history?page=${page}&size=20`)

/** 관리자 화면에서 보는 AI 사용량 한 줄. 날짜, 목적, 모델별로 묶여서 와요. */
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

export const isAdmin = (me: Me | null) => me?.role === 'ADMIN'

/** from(YYYY-MM-DD)부터 오늘까지의 AI 사용량을 받아요. 서버가 관리자 계정만 허용해요. */
export async function fetchAiUsage(from: string): Promise<{ ok: true; data: AiUsageRow[] } | { ok: false; message: string }> {
  try {
    const result = await authFetch<AiUsageRow[]>(`/ai-usage/daily?from=${from}`)
    if (result.status === 403) return { ok: false, message: '관리자 계정만 볼 수 있는 화면이에요.' }
    return result.ok && result.data ? { ok: true, data: result.data } : { ok: false, message: messageOf(result.code) }
  } catch {
    return { ok: false, message: NETWORK_MESSAGE }
  }
}

export const fetchMyChats = (page: number) => fetchList<Slice<ChatSummary>>(`/users/me/chats?page=${page}&size=20`)

export async function revokeSession(sessionId: string): Promise<boolean> {
  try {
    return (await authFetch<null>(`/auth/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })).ok
  } catch {
    return false
  }
}
