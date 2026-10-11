import type { AnalyzeRequest, ChatEvent, ChatSnapshot } from '../../shared/types'
import { authHeaders } from './auth'
import { apiUrl, ownerHeaders, readResult } from './http'

/** 서버에 채팅 저장 기능이 켜져 있는지 물어봐요. */
export async function fetchStorageEnabled(): Promise<boolean> {
  try {
    const result = await readResult<{ storage?: boolean }>(await fetch(apiUrl('/config')))
    return result.ok && result.data?.storage === true
  } catch {
    return false
  }
}

/** 저장된 채팅을 불러와요. 없거나 볼 수 없는 채팅이면 null을 돌려줘요. */
export async function fetchChat(id: string): Promise<ChatSnapshot | null> {
  const res = await fetch(apiUrl(`/chats/${id}`), { headers: { ...ownerHeaders(), ...(await authHeaders()) } })
  const result = await readResult<ChatSnapshot>(res)
  return result.ok ? result.data : null
}

export async function shareChat(id: string): Promise<boolean> {
  const res = await fetch(apiUrl(`/chats/${id}/share`), {
    method: 'POST',
    headers: { ...ownerHeaders(), ...(await authHeaders()) },
  })
  return res.ok
}

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
        if (line.startsWith('data:')) onEvent(JSON.parse(line.slice(5).trimStart()) as ChatEvent)
      }
    }
  }
}
