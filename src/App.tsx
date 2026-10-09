import { useCallback, useEffect, useRef } from 'react'
import { Chat } from './components/Chat'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { useAnalysis } from './hooks/useAnalysis'
import { useAuth } from './hooks/useAuth'
import { LOGIN_URL } from './lib/api'

/** 로그인하고 돌아왔을 때 이어서 분석할 레포 주소를 잠깐 기억해 둬요. 토큰은 저장하지 않아요. */
const PENDING_REPO_KEY = 'whoisloafing:pending-repo'

function takePendingRepo(): string | null {
  try {
    const url = sessionStorage.getItem(PENDING_REPO_KEY)
    sessionStorage.removeItem(PENDING_REPO_KEY)
    return url
  } catch {
    return null
  }
}

export default function App() {
  const { user, ready, logout } = useAuth()
  const { messages, busy, send, say, reset } = useAnalysis()
  const resumed = useRef(false)

  // 로그인 직후에는 기다리던 레포를 바로 이어서 분석하고, 로그인에 실패했다면 말풍선으로 알려줘요.
  useEffect(() => {
    if (!ready || resumed.current) return
    resumed.current = true

    const params = new URLSearchParams(window.location.search)
    const failed = params.get('login') === 'failed'
    if (failed) window.history.replaceState(null, '', window.location.pathname)

    const pending = takePendingRepo()
    if (failed) say('로그인하지 못했어요. 잠시 뒤에 다시 시도해 주세요.')
    else if (user && pending) void send({ url: pending }, pending)
  }, [ready, user, send, say])

  const handleLogin = useCallback((repoUrl?: string) => {
    try {
      if (repoUrl) sessionStorage.setItem(PENDING_REPO_KEY, repoUrl)
    } catch {
      // 저장소를 쓸 수 없어도 로그인은 그대로 진행해요.
    }
    window.location.href = LOGIN_URL
  }, [])

  const handleSubmit = useCallback((url: string) => void send({ url }, url.trim()), [send])

  return (
    <div className="relative flex h-dvh flex-col bg-white">
      <Header user={user} authReady={ready} onLogout={logout} onHome={reset} />
      {messages.length === 0 ? (
        <Hero onSubmit={handleSubmit} />
      ) : (
        <Chat messages={messages} busy={busy} onLogin={handleLogin} onSend={send} />
      )}
    </div>
  )
}
