const OWNER_KEY_STORAGE = 'whoisloafing:owner'

/**
 * 이 브라우저에서 만든 채팅을 알아보기 위한 무작위 값이에요. 로그인 정보나 토큰이 아니에요.
 * 서버는 이 값의 해시만 저장하고, 공유하기 전의 채팅은 같은 값을 가진 브라우저만 열 수 있어요.
 */
function ownerKey(): string {
  try {
    let key = localStorage.getItem(OWNER_KEY_STORAGE)
    if (!key) {
      key = `${crypto.randomUUID()}${crypto.randomUUID()}`
      localStorage.setItem(OWNER_KEY_STORAGE, key)
    }
    return key
  } catch {
    return ''
  }
}

export const ownerHeaders = (): Record<string, string> => {
  const key = ownerKey()
  return key ? { 'X-Owner-Key': key } : {}
}

const API_BASE = `${((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').replace(/\/+$/, '')}/api/v1`

export const apiUrl = (path: string) => `${API_BASE}${path}`

export interface ApiResult<T> {
  ok: boolean
  status: number
  data: T | null
  code: string | null
}

export async function readResult<T>(res: Response): Promise<ApiResult<T>> {
  const body = (await res.json().catch(() => null)) as { data?: T; error?: { code?: string | null } } | null
  return { ok: res.ok, status: res.status, data: body?.data ?? null, code: body?.error?.code ?? null }
}
