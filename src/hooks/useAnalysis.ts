import { useCallback, useRef, useState } from 'react'
import type { ChatEvent } from '../../shared/types'
import { streamAnalysis } from '../lib/api'

export type ChatMessage =
  | { id: number; from: 'user'; text: string }
  | { id: number; from: 'bot'; event: Exclude<ChatEvent, { type: 'done' }>; repoUrl?: string }

type NewMessage = ChatMessage extends infer M ? (M extends unknown ? Omit<M, 'id'> : never) : never

/** 다음 말풍선이 나오기 전에 입력 중 표시를 보여주는 시간 */
const TYPING_DELAY_MS = 700

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function useAnalysis() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const nextId = useRef(1)

  const append = useCallback((message: NewMessage) => {
    setMessages((prev) => [...prev, { ...message, id: nextId.current++ } as ChatMessage])
  }, [])

  const say = useCallback(
    (text: string) => append({ from: 'bot', event: { type: 'text', text } }),
    [append],
  )

  const analyze = useCallback(
    async (url: string, options: { excludeGenerated?: boolean; userText?: string } = {}) => {
      const trimmed = url.trim()
      if (!trimmed || busyRef.current) return
      busyRef.current = true
      setBusy(true)
      append({ from: 'user', text: options.userText ?? trimmed })

      // 서버에서 온 메시지를 큐에 쌓아 두고, 입력 중 표시를 거쳐 하나씩 화면에 올려요.
      const queue: ChatEvent[] = []
      let finished = false
      let wake: (() => void) | null = null
      const push = (event: ChatEvent) => {
        queue.push(event)
        wake?.()
      }

      streamAnalysis({ url: trimmed, excludeGenerated: options.excludeGenerated }, push)
        .catch(() => push({ type: 'error', text: '서버와 연결이 끊어졌어요. 잠시 뒤에 다시 시도해 주세요.' }))
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
        await sleep(TYPING_DELAY_MS)
        append({ from: 'bot', event, repoUrl: trimmed })
      }

      busyRef.current = false
      setBusy(false)
    },
    [append],
  )

  const reset = useCallback(() => {
    if (!busyRef.current) setMessages([])
  }, [])

  return { messages, busy, analyze, say, reset }
}
