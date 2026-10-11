import type { AnalyzeRequest, ChatEvent, ChatSnapshot } from '../../shared/types'
import { authFetch, authHeaders } from './auth'
import { apiUrl, ownerHeaders, readResult } from './http'

export interface ServerConfig {
  /** 채팅 저장과 공유 기능이 켜져 있는지 */
  storage: boolean
  /** 서버가 심층 분석 질문을 받을 수 있는지. 예전 서버에는 없어서, 그때는 메뉴에서 심층 분석을 숨겨요. */
  deep: boolean
}

/** 서버가 어떤 기능을 지원하는지 물어봐요. */
export async function fetchConfig(): Promise<ServerConfig> {
  try {
    const result = await readResult<Partial<ServerConfig>>(await fetch(apiUrl('/config')))
    return { storage: result.ok && result.data?.storage === true, deep: result.ok && result.data?.deep === true }
  } catch {
    return { storage: false, deep: false }
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
