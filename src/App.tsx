import { useCallback } from 'react'
import { Chat } from './components/Chat'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { useAnalysis } from './hooks/useAnalysis'

export default function App() {
  const { messages, busy, paused, send, resume, reset } = useAnalysis()

  const handleSubmit = useCallback((url: string) => void send({ url }, url.trim()), [send])

  return (
    <div className="relative flex h-dvh flex-col bg-white">
      <Header onHome={reset} />
      {messages.length === 0 ? (
        <Hero onSubmit={handleSubmit} />
      ) : (
        <Chat messages={messages} busy={busy} paused={paused} onResume={resume} onSend={send} />
      )}
    </div>
  )
}
