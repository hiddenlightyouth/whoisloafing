import type { AnalyzeRequest, ChatEvent, ChatSnapshot, DeepReport, DeepSection } from '../../shared/types'
import { authFetch, authHeaders } from './auth'
import { apiUrl, ownerHeaders, readResult } from './http'

export interface ServerConfig {
  /** 채팅 저장과 공유 기능이 켜져 있는지 */
  storage: boolean
  /** 서버에 심층 분석 API가 있는지. 예전 서버에는 없어서, 그때는 앱의 사이드바에서 심층 분석을 숨겨요. */
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

const DEEP_ERRORS: Record<string, string> = {
  C003: '레포 주소가 올바르지 않아요.',
  C4044: '찾을 수 없는 레포예요. 주소를 다시 확인해 주세요.',
  C4032: '비공개 레포는 분석할 수 없어요.',
  C4033: '서버가 이 레포에 접근할 수 없어요. 레포의 조직이 접근을 제한하고 있을 수 있어요.',
  C429: '요청이 너무 많아요. 잠시 뒤에 다시 시도해 주세요.',
}

/** 심층 분석의 탭 하나를 받아요. 로그인해야 받을 수 있어요. 실패하면 화면에 보여줄 안내를 돌려줘요. */
export async function fetchDeepReport(repo: string, section: DeepSection): Promise<{ report: DeepReport } | { error: string }> {
  try {
    const result = await authFetch<DeepReport>(`/deep/${section}?url=${encodeURIComponent(repo)}`)
    if (result.ok && result.data) return { report: result.data }
    return { error: (result.code && DEEP_ERRORS[result.code]) || '분석하지 못했어요. 잠시 뒤에 다시 시도해 주세요.' }
  } catch {
    return { error: '서버와 연결하지 못했어요. 잠시 뒤에 다시 시도해 주세요.' }
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
