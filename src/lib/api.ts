import type { AnalyzeRequest, ChatEvent, ChatSnapshot } from '../../shared/types'

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

const ownerHeaders = (): Record<string, string> => {
  const key = ownerKey()
  return key ? { 'X-Owner-Key': key } : {}
}

/** 서버에 채팅 저장 기능이 켜져 있는지 물어봐요. */
export async function fetchStorageEnabled(): Promise<boolean> {
  try {
    const res = await fetch('/api/config')
    return res.ok && ((await res.json()) as { storage?: boolean }).storage === true
  } catch {
    return false
  }
}

/** 저장된 채팅을 불러와요. 없거나 볼 수 없는 채팅이면 null을 돌려줘요. */
export async function fetchChat(id: string): Promise<ChatSnapshot | null> {
  const res = await fetch(`/api/chats/${id}`, { headers: ownerHeaders() })
  if (!res.ok) return null
  return (await res.json()) as ChatSnapshot
}

export async function shareChat(id: string): Promise<boolean> {
  const res = await fetch(`/api/chats/${id}/share`, { method: 'POST', headers: ownerHeaders() })
  return res.ok
}

/** 서버가 SSE로 흘려보내는 분석 메시지를 하나씩 받아서 넘겨줘요. */
export async function streamAnalysis(
  request: AnalyzeRequest,
  onEvent: (event: ChatEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...ownerHeaders() },
    // 시간대별 통계를 사용자의 시간대로 보여주려고 함께 보내요.
    body: JSON.stringify({ ...request, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
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
        if (line.startsWith('data: ')) onEvent(JSON.parse(line.slice(6)) as ChatEvent)
      }
    }
  }
}
