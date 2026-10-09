import type { AnalyzeRequest, ChatEvent, SessionUser } from '../../shared/types'

export const LOGIN_URL = '/api/auth/github'

export async function fetchUser(): Promise<SessionUser | null> {
  const res = await fetch('/api/auth/me', { credentials: 'same-origin' })
  if (!res.ok) return null
  const data = (await res.json()) as { user: SessionUser | null }
  return data.user
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
}

/** 서버가 SSE로 흘려보내는 분석 메시지를 하나씩 받아서 넘겨줘요. */
export async function streamAnalysis(request: AnalyzeRequest, onEvent: (event: ChatEvent) => void): Promise<void> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    // 시간대별 통계를 사용자의 시간대로 보여주려고 함께 보내요.
    body: JSON.stringify({ ...request, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
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
