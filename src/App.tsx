import { useCallback, useEffect, useState } from 'react'
import { Chat } from './components/Chat'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { useAnalysis } from './hooks/useAnalysis'
import { initAnalytics, repoLabel, track, trackPageView } from './lib/analytics'
import { fetchChat, fetchStorageEnabled, shareChat } from './lib/api'

const CHAT_PATH = /^\/c\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i

const chatIdFromPath = () => CHAT_PATH.exec(window.location.pathname)?.[1] ?? null

async function copyLink(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(window.location.href)
    return true
  } catch {
    return false
  }
}

export default function App() {
  const { messages, busy, paused, send, resume, stop, reset, load, chatId } = useAnalysis()
  /** 서버에 채팅 저장 기능(Supabase)이 켜져 있는지 */
  const [storage, setStorage] = useState(false)
  /** 지금 보고 있는 채팅의 상태. mine은 이 브라우저에서 만든 채팅인지, shared는 공유됐는지예요. */
  const [chat, setChat] = useState<{ mine: boolean; shared: boolean } | null>(null)
  const [opening, setOpening] = useState(() => chatIdFromPath() !== null)
  const [missing, setMissing] = useState(false)

  // 주소에 맞는 화면을 준비해요. 처음 들어왔을 때와 뒤로 가기, 앞으로 가기에서 불러요.
  const openFromLocation = useCallback(async () => {
    const id = chatIdFromPath()
    setMissing(false)
    if (!id) {
      reset()
      setChat(null)
      setOpening(false)
      trackPageView('home')
      return
    }
    setOpening(true)
    const snapshot = await fetchChat(id).catch(() => null)
    setOpening(false)
    if (!snapshot) {
      reset()
      setChat(null)
      setMissing(true)
      track('chat_open_failed')
      return
    }
    load(snapshot)
    setChat({ mine: snapshot.owner, shared: snapshot.shared })
    trackPageView(snapshot.shared ? 'shared_chat' : 'chat', {
      repo: repoLabel(snapshot.repoUrl),
      is_owner: snapshot.owner,
      message_count: snapshot.messages.length,
    })
  }, [load, reset])

  useEffect(() => {
    initAnalytics()
    void fetchStorageEnabled().then(setStorage)
    void openFromLocation()
    const onPopState = () => void openFromLocation()
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [openFromLocation])

  const handleSubmit = useCallback(
    (url: string) => {
      // 저장 기능이 켜져 있으면 채팅마다 고유한 주소를 만들어서, 새로 고쳐도 다시 열 수 있게 해요.
      const id = storage ? crypto.randomUUID() : null
      if (!reset(id)) return
      if (id) {
        window.history.pushState(null, '', `/c/${id}`)
        setChat({ mine: true, shared: false })
      }
      track('repo_submit', { repo: repoLabel(url), storage })
      trackPageView('chat', { repo: repoLabel(url), is_owner: true })
      void send({ url }, url.trim())
    },
    [reset, send, storage],
  )

  const handleHome = useCallback(() => {
    if (!reset()) return
    track('home_click', { from: chat?.shared ? 'shared_chat' : messages.length > 0 ? 'chat' : 'home' })
    setChat(null)
    setMissing(false)
    if (window.location.pathname !== '/') window.history.pushState(null, '', '/')
    trackPageView('home')
  }, [chat, messages.length, reset])

  const handleShare = useCallback(async () => {
    const id = chatId.current
    if (!id) return false
    const ok = await shareChat(id).catch(() => false)
    track(ok ? 'share_confirm' : 'share_failed', { message_count: messages.length })
    if (!ok) return false
    setChat({ mine: true, shared: true })
    await copyLink()
    return true
  }, [chatId, messages.length])

  const handleCopyLink = useCallback(async () => {
    const ok = await copyLink()
    track('share_link_copy', { success: ok, is_owner: chat?.mine === true })
    return ok
  }, [chat])

  // 공유된 채팅과 다른 브라우저에서 만든 채팅은 읽기만 할 수 있어요.
  const readOnly = chat !== null && (chat.shared || !chat.mine)

  return (
    <div className="relative flex h-dvh flex-col bg-white">
      <Header
        onHome={handleHome}
        inChat={messages.length > 0 && !readOnly}
        storage={storage}
        busy={busy}
        onStop={stop}
        shared={chat?.shared === true}
        onShare={handleShare}
        onCopyLink={handleCopyLink}
      />
      {opening ? (
        <main className="flex flex-1 items-center justify-center text-[15px] text-gray-400">채팅을 불러오고 있어요.</main>
      ) : missing ? (
        <main className="flex flex-1 flex-col items-center justify-center gap-4 px-5 text-center">
          <p className="text-[15px] leading-relaxed text-gray-600">
            이 채팅을 열 수 없어요.
            <br />
            아직 공유되지 않았거나 없는 채팅이에요.
          </p>
          <button
            type="button"
            onClick={handleHome}
            className="h-10 rounded-full bg-brand px-5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            홈으로
          </button>
        </main>
      ) : messages.length === 0 ? (
        <Hero onSubmit={handleSubmit} />
      ) : (
        <Chat
          messages={messages}
          busy={busy}
          paused={paused}
          readOnly={readOnly}
          onResume={resume}
          onSend={send}
          onHome={handleHome}
        />
      )}
    </div>
  )
}
