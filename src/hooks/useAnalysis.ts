import { useCallback, useRef, useState } from 'react'
import type { AnalyzeRequest, ChatEvent } from '../../shared/types'
import { streamAnalysis } from '../lib/api'

export type ChatMessage =
  | { id: number; from: 'user'; text: string }
  | {
      id: number
      from: 'bot'
      event: Exclude<ChatEvent, { type: 'done' | 'pause' }>
      /** 이 말풍선을 만든 요청. 다시 시도하거나 이어서 질문할 때 그대로 써요. */
      request?: AnalyzeRequest
    }

type NewMessage = ChatMessage extends infer M ? (M extends unknown ? Omit<M, 'id'> : never) : never

/** 다음 말풍선이 나오기 전에 입력 중 표시를 보여주는 시간 */
const TYPING_DELAY_MS = 700

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function useAnalysis() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [busy, setBusy] = useState(false)
  /** 한 단계가 끝나서 계속하기를 기다리는 중이면 다음 단계 안내가 들어 있어요. */
  const [paused, setPaused] = useState<string | null>(null)
  const resumeRef = useRef<(() => void) | null>(null)
  const busyRef = useRef(false)
  const nextId = useRef(1)

  const append = useCallback((message: NewMessage) => {
    setMessages((prev) => [...prev, { ...message, id: nextId.current++ } as ChatMessage])
  }, [])

  const say = useCallback(
    (text: string) => append({ from: 'bot', event: { type: 'text', text } }),
    [append],
  )

  /** userText가 있으면 사용자 말풍선을 먼저 올리고, 없으면(다시 시도) 조용히 요청만 보내요. */
  const send = useCallback(
    async (request: AnalyzeRequest, userText?: string) => {
      const url = request.url.trim()
      if (!url || busyRef.current) return
      const current = { ...request, url }
      busyRef.current = true
      setBusy(true)
      if (userText) append({ from: 'user', text: userText })

      // 서버에서 온 메시지를 큐에 쌓아 두고, 입력 중 표시를 거쳐 하나씩 화면에 올려요.
      const queue: ChatEvent[] = []
      let finished = false
      let wake: (() => void) | null = null
      const push = (event: ChatEvent) => {
        queue.push(event)
        wake?.()
      }

      streamAnalysis(current, push)
        .catch(() =>
          push({ type: 'error', text: '서버와 연결이 끊어졌어요. 잠시 뒤에 다시 시도해 주세요.', action: 'retry' }),
        )
        .finally(() => {
          finished = true
          wake?.()
        })

      while (true) {
        const event = queue.shift()
        if (!event) {
          if (finished) break
          await new Promise<void>((resolve) => (wake = resolve))
          wake = null
          continue
        }
        if (event.type === 'done') break
        if (event.type === 'pause') {
          // 서버는 뒤에서 계속 분석하고, 화면만 사용자가 계속하기를 누를 때까지 기다려요.
          setPaused(event.next)
          await new Promise<void>((resolve) => (resumeRef.current = resolve))
          resumeRef.current = null
          setPaused(null)
          continue
        }
        await sleep(TYPING_DELAY_MS)
        append({ from: 'bot', event, request: current })
      }

      busyRef.current = false
      setBusy(false)
    },
    [append],
  )

  const resume = useCallback(() => resumeRef.current?.(), [])

  const reset = useCallback(() => {
    if (!busyRef.current) setMessages([])
  }, [])

  return { messages, busy, paused, send, resume, say, reset }
}
