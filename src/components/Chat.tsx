import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../hooks/useAnalysis'
import { Bubble } from './Bubble'
import { TypingDots } from './TypingDots'

interface Props {
  messages: ChatMessage[]
  busy: boolean
  onLogin: (repoUrl?: string) => void
  onChoose: (repoUrl: string, excludeGenerated: boolean) => void
  onRetry: (repoUrl: string, excludeGenerated?: boolean) => void
}

/** 맨 아래에서 이만큼 안쪽이면 아래에 붙어 있는 것으로 봐요. */
const BOTTOM_THRESHOLD_PX = 80

export function Chat({ messages, busy, onLogin, onChoose, onRetry }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  const [atBottom, setAtBottom] = useState(true)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior })
  }, [])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD_PX
    pinned.current = near
    setAtBottom(near)
  }

  // 아래에 붙어 있을 때만 새 말풍선을 따라 내려가요. 위로 올려서 읽는 중이면 그대로 둬요.
  useEffect(() => {
    if (pinned.current) scrollToBottom()
  }, [messages.length, busy, scrollToBottom])

  return (
    <main className="relative flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 pt-14 sm:px-6">
        <div
          className="mx-auto flex max-w-2xl flex-col gap-2.5 pt-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]"
          aria-live="polite"
        >
          {messages.map((message, index) => (
            <Bubble
              key={message.id}
              message={message}
              busy={busy}
              isLast={index === messages.length - 1}
              onLogin={onLogin}
              onChoose={onChoose}
              onRetry={onRetry}
            />
          ))}
          {/* 말풍선이 하나 올라올 때마다 새로 그려서, 오래 기다릴 때만 문구가 나오게 해요. */}
          {busy && <TypingDots key={messages.length} />}
        </div>
      </div>

      <button
        type="button"
        aria-label="맨 아래로 이동"
        tabIndex={atBottom ? -1 : 0}
        onClick={() => scrollToBottom()}
        className={`absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-all duration-200 hover:text-brand ${
          atBottom ? 'pointer-events-none translate-y-2 opacity-0' : 'opacity-100'
        }`}
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4" aria-hidden="true">
          <path d="M10 4v12M5 11l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </main>
  )
}
