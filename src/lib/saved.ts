import { loadConfig } from './api'
import { authFetch, isSignedIn } from './auth'

// 포트폴리오와 이력서를 계정에 저장하고 불러와요. 서버는 보낸 JSON을 그대로 담아 두고 돌려줘요.

/** 계정에 저장할 수 있는지. 서버에 저장 API가 있고 로그인했을 때예요. */
export async function canSync(): Promise<boolean> {
  return isSignedIn() && (await loadConfig()).portfolioSync
}

/** 계정에 저장한 것을 받아요. 저장한 것이 없으면 data가 null이고, 받지 못하면 null이에요. */
export async function fetchSaved<T>(path: string): Promise<{ data: T | null } | null> {
  try {
    const result = await authFetch<{ data: T | null }>(path)
    return result.ok && result.data ? { data: result.data.data } : null
  } catch {
    return null
  }
}

export async function putSaved(path: string, body: unknown, keepalive = false): Promise<boolean> {
  try {
    const result = await authFetch(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive,
    })
    return result.ok
  } catch {
    return false
  }
}

export async function deleteSaved(path: string): Promise<boolean> {
  try {
    return (await authFetch(path, { method: 'DELETE' })).ok
  } catch {
    return false
  }
}

const SAVE_DELAY_MS = 800

interface Scheduled {
  timer: ReturnType<typeof setTimeout>
  send: (keepalive: boolean) => Promise<void>
}

const scheduled = new Map<string, Scheduled>()

/** 고칠 때마다 보내지 않고 잠깐 모아서 마지막 것만 보내요. 같은 key로 다시 부르면 앞의 것은 버려요. */
export function scheduleSave(key: string, send: (keepalive: boolean) => Promise<void>) {
  cancelSave(key)
  const timer = setTimeout(() => {
    scheduled.delete(key)
    void send(false)
  }, SAVE_DELAY_MS)
  scheduled.set(key, { timer, send })
}

export function cancelSave(key: string) {
  const item = scheduled.get(key)
  if (!item) return
  clearTimeout(item.timer)
  scheduled.delete(key)
}

// 창을 닫거나 다른 앱으로 넘어가면 모아 둔 저장을 바로 보내요.
function flushAll() {
  for (const [key, item] of scheduled) {
    clearTimeout(item.timer)
    scheduled.delete(key)
    void item.send(true)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushAll)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAll()
  })
}
