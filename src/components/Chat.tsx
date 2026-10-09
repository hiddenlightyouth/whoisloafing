import { useEffect, useRef } from 'react'
import type { ChatMessage } from '../hooks/useAnalysis'
import { Bubble } from './Bubble'
import { RepoInput } from './RepoInput'
import { TypingDots } from './TypingDots'

interface Props {
  messages: ChatMessage[]
  busy: boolean
  onSubmit: (url: string) => void
  onLogin: (repoUrl?: string) => void
  onChoose: (repoUrl: string, excludeGenerated: boolean) => void
}

export function Chat({ messages, busy, onSubmit, onLogin, onChoose }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, busy])

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-4 sm:px-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-2.5 py-6" aria-live="polite">
          {messages.map((message, index) => (
            <Bubble
              key={message.id}
              message={message}
              busy={busy}
              isLast={index === messages.length - 1}
              onLogin={onLogin}
              onChoose={onChoose}
            />
          ))}
          {busy && <TypingDots />}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-100 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="mx-auto max-w-2xl">
          <RepoInput onSubmit={onSubmit} disabled={busy} />
        </div>
      </div>
    </main>
  )
}
