import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { AccountPage } from './components/Account'
import { Chat } from './components/Chat'
import { ChatSkeleton } from './components/Skeleton'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { LeaveDialog } from './components/LeaveDialog'
import { LoginNudge } from './components/LoginNudge'
import { Toast } from './components/Toast'
import { useAnalysis } from './hooks/useAnalysis'
import { initAnalytics, repoLabel, track, trackPageView } from './lib/analytics'
import { fetchChat, fetchStorageEnabled, shareChat } from './lib/api'
import { claimChats, loadMe, useAuth } from './lib/auth'
import { showToast } from './lib/toast'

const CHAT_PATH = /^\/c\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i

const chatIdFromPath = () => CHAT_PATH.exec(window.location.pathname)?.[1] ?? null

const ARTICLE_PATH = /^\/articles(?:\/([^/]+))?\/?$/

/** 아티클 주소면 보고 있는 글을 돌려줘요. slug가 null이면 목록이에요. */
function articleFromPath(): { slug: string | null } | null {
  const match = ARTICLE_PATH.exec(window.location.pathname)
  return match ? { slug: match[1] ?? null } : null
}

const ACCOUNT_PATH = /^\/(login|signup|me|history)\/?$/

const accountFromPath = () => (ACCOUNT_PATH.exec(window.location.pathname)?.[1] as AccountPage | undefined) ?? null

const Account = lazy(() => import('./components/Account').then((module) => ({ default: module.Account })))

// 아티클 글과 마크다운 변환 코드는 아티클 화면을 열 때만 받아요.
const Articles = lazy(() => import('./components/Articles').then((module) => ({ default: module.Articles })))

const NUDGE_DISMISSED_KEY = 'whoisloafing:login-nudge-dismissed'

/** 로그인 안내를 이 탭에서 이미 닫았는지. 한 번 닫으면 탭을 닫을 때까지 다시 띄우지 않아요. */
function nudgeDismissed(): boolean {
  try {
    return sessionStorage.getItem(NUDGE_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

async function copyLink(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(window.location.href)
    return true
  } catch {
    return false
  }
}

export default function App() {
  const { messages, busy, paused, send, resume, stop, abandon, reset, load, settle, chatId } = useAnalysis()
  /** 서버에 채팅 저장 기능(Supabase)이 켜져 있는지 */
  const [storage, setStorage] = useState(false)
  /** 지금 보고 있는 채팅의 상태. mine은 이 브라우저에서 만든 채팅인지, shared는 공유됐는지예요. */
  const [chat, setChat] = useState<{ mine: boolean; shared: boolean } | null>(null)
  const [opening, setOpening] = useState(() => chatIdFromPath() !== null)
  const [missing, setMissing] = useState(false)
  /** 아티클 화면을 보고 있는지. slug가 null이면 목록이에요. */
  const [article, setArticle] = useState(articleFromPath)
  const [account, setAccount] = useState(accountFromPath)
  const { tokens } = useAuth()
  /** 분석 중에 로고를 눌렀을 때 정말 떠날지 묻는 창 */
  const [confirmingLeave, setConfirmingLeave] = useState(false)
  /** 채팅에서 로그인 화면으로 갔을 때, 로그인한 뒤에 돌아올 채팅과 로그인 화면에 보여줄 안내 */
  const loginReturn = useRef<{ id: string; notice: string } | null>(null)
  const [nudgeClosed, setNudgeClosed] = useState(nudgeDismissed)
  /** 분석이 도는 중에 로그인해서, 그 요청이 끝나면 채팅을 계정에 한 번 더 연결해야 하는지 */
  const claimWhenIdle = useRef(false)

  // 주소에 맞는 화면을 준비해요. 처음 들어왔을 때와 뒤로 가기, 앞으로 가기에서 불러요.
  const openFromLocation = useCallback(async () => {
    const id = chatIdFromPath()
    const nextArticle = articleFromPath()
    const nextAccount = accountFromPath()
    setMissing(false)
    setArticle(nextArticle)
    setAccount(nextAccount)
    if (nextAccount) {
      // 채팅을 들고 로그인 화면에 와 있는 중이면 채팅을 그대로 둬요.
      const holding = nextAccount !== 'me' && nextAccount !== 'history' && loginReturn.current?.id === chatId.current
      if (!holding) {
        reset()
        setChat(null)
      }
      setOpening(false)
      trackPageView(nextAccount)
      return
    }
    if (nextArticle) {
      reset()
      setChat(null)
      setOpening(false)
      trackPageView(nextArticle.slug ? 'article' : 'articles', { slug: nextArticle.slug ?? undefined })
      return
    }
    if (!id) {
      reset()
      setChat(null)
      setOpening(false)
      trackPageView('home')
      return
    }
    // 화면에 이미 올라와 있는 채팅이면 다시 받지 않아요. 분석이 돌고 있어도 끊기지 않아요.
    if (id === chatId.current) {
      setOpening(false)
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
  }, [chatId, load, reset])

  useEffect(() => {
    initAnalytics()
    void fetchStorageEnabled().then(setStorage)
    void loadMe()
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

  const goHome = useCallback(() => {
    if (!reset()) return
    loginReturn.current = null
    track('home_click', { from: account ?? (article ? 'articles' : chat?.shared ? 'shared_chat' : messages.length > 0 ? 'chat' : 'home') })
    setChat(null)
    setMissing(false)
    setArticle(null)
    setAccount(null)
    if (window.location.pathname !== '/') window.history.pushState(null, '', '/')
    trackPageView('home')
  }, [account, article, chat, messages.length, reset])

  /** 아티클 목록(slug가 null)이나 글 하나를 열어요. */
  const openArticle = useCallback(
    (slug: string | null) => {
      if (!reset()) return
      loginReturn.current = null
      setChat(null)
      setMissing(false)
      setAccount(null)
      setArticle({ slug })
      window.history.pushState(null, '', slug ? `/articles/${slug}` : '/articles')
      trackPageView(slug ? 'article' : 'articles', { slug: slug ?? undefined })
    },
    [reset],
  )

  const openAccount = useCallback(
    (page: AccountPage, replace = false) => {
      if (page === 'me' || page === 'history') loginReturn.current = null
      // 채팅을 들고 로그인 화면으로 갈 때는 채팅을 비우지 않아서, 돌던 분석이 뒤에서 그대로 이어져요.
      const holding = loginReturn.current !== null && loginReturn.current.id === chatId.current
      if (!holding) {
        if (!reset()) return
        setChat(null)
      }
      setMissing(false)
      setArticle(null)
      setAccount(page)
      if (replace) window.history.replaceState(null, '', `/${page}`)
      else window.history.pushState(null, '', `/${page}`)
      trackPageView(page)
    },
    [chatId, reset],
  )

  const openChat = useCallback(
    (id: string, replace = false) => {
      loginReturn.current = null
      if (replace) window.history.replaceState(null, '', `/c/${id}`)
      else window.history.pushState(null, '', `/c/${id}`)
      void openFromLocation()
    },
    [openFromLocation],
  )

  // 로그인 화면에서 로그인하면, 보던 채팅이 있으면 그리로 돌아가고 아니면 내 작업으로 가요.
  const handleSignedIn = useCallback(() => {
    const id = loginReturn.current?.id
    if (!id) {
      openAccount('history', true)
      return
    }
    if (id === chatId.current) {
      // 로그인하는 사이에도 돌고 있던 요청은 로그인 전에 보낸 것이라, 끝난 뒤에 계정에 한 번 더 연결해요.
      claimWhenIdle.current = true
      trackPageView('chat', { is_owner: true })
    }
    openChat(id, true)
  }, [chatId, openAccount, openChat])

  const loginFromChat = useCallback(
    (notice: string) => {
      const id = chatId.current
      if (!id) return
      loginReturn.current = { id, notice }
      settle()
      openAccount('login')
    },
    [chatId, openAccount, settle],
  )

  const handleLoginToShare = useCallback(() => loginFromChat('로그인하면 공유하려던 채팅으로 바로 돌아가요.'), [loginFromChat])

  const closeNudge = useCallback(() => {
    track('login_nudge_close')
    setNudgeClosed(true)
    try {
      sessionStorage.setItem(NUDGE_DISMISSED_KEY, '1')
    } catch {
      // 저장하지 못해도 이번 화면에서는 닫혀 있어요.
    }
  }, [])

  const handleNudgeLogin = useCallback(() => {
    track('login_nudge_click', { busy })
    loginFromChat('로그인하면 분석하던 채팅으로 바로 돌아가요.')
  }, [busy, loginFromChat])

  useEffect(() => {
    if (busy || !claimWhenIdle.current) return
    claimWhenIdle.current = false
    void claimChats()
  }, [busy, account])

  // 공유된 채팅과 다른 브라우저에서 만든 채팅은 읽기만 할 수 있어요.
  const readOnly = chat !== null && (chat.shared || !chat.mine)
  // 내가 진행 중인 채팅이 화면에 있으면, 떠나기 전에 항상 물어봐요. 분석이 잠깐 멈춰 있을 때(질문을 기다리는 중)도 마찬가지예요.
  const working = busy || (messages.length > 0 && !readOnly)
  // 로그인하지 않고 분석하는 동안, 첫 말풍선이 나온 뒤에 로그인을 권해요.
  const nudging =
    storage && tokens === null && !nudgeClosed && !account && !article && !readOnly && messages.some((message) => message.from === 'bot')
  useEffect(() => {
    if (nudging) track('login_nudge_view')
  }, [nudging])

  const handleHome = useCallback(() => {
    if (!working) {
      goHome()
      return
    }
    track('leave_confirm_open', { busy })
    setConfirmingLeave(true)
  }, [busy, goHome, working])

  // 새로 고치거나 탭을 닫을 때도 잃어버리는 작업이 있으면 브라우저의 경고 창을 띄워요.
  // 저장 기능이 켜져 있으면 끝난 요청까지는 다시 열 수 있어서, 분석이 돌고 있을 때만 경고해요.
  const unsaved = busy || (working && !storage)
  useEffect(() => {
    if (!unsaved) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [unsaved])

  const handleLeave = useCallback(() => {
    track('leave_confirm', { message_count: messages.length })
    setConfirmingLeave(false)
    abandon()
    goHome()
  }, [abandon, goHome, messages.length])

  const handleStay = useCallback(() => {
    track('leave_cancel')
    setConfirmingLeave(false)
  }, [])

  const handleShare = useCallback(async () => {
    const id = chatId.current
    if (!id) return false
    const ok = await shareChat(id).catch(() => false)
    track(ok ? 'share_confirm' : 'share_failed', { message_count: messages.length })
    if (!ok) return false
    setChat({ mine: true, shared: true })
    // 휴대폰 브라우저는 공유 요청을 기다리는 사이에 복사 권한이 사라지기도 해서, 그때는 링크 복사 버튼을 안내해요.
    showToast((await copyLink()) ? '공유했어요. 링크를 복사했어요.' : '공유했어요. 링크 복사를 눌러 링크를 가져가세요.')
    return true
  }, [chatId, messages.length])

  const handleCopyLink = useCallback(async () => {
    const ok = await copyLink()
    track('share_link_copy', { success: ok, is_owner: chat?.mine === true })
    return ok
  }, [chat])

  return (
    <div className="relative flex h-dvh flex-col bg-white">
      <Header
        onHome={handleHome}
        inChat={messages.length > 0 && !readOnly && !account}
        storage={storage}
        busy={busy}
        onStop={stop}
        shared={chat?.shared === true}
        onShare={handleShare}
        onCopyLink={handleCopyLink}
        onLoginToShare={handleLoginToShare}
        onArticles={
          working
            ? undefined
            : () => {
                track('article_nav_click', { from: account ?? (article ? 'articles' : messages.length > 0 ? 'chat' : 'home') })
                openArticle(null)
              }
        }
        signedIn={tokens !== null}
        onAccount={working ? undefined : openAccount}
      />
      {article ? (
        <Suspense fallback={<main className="flex-1" />}>
          <Articles slug={article.slug} onOpen={openArticle} onHome={goHome} />
        </Suspense>
      ) : account ? (
        <Suspense fallback={<main className="flex-1" />}>
          <Account
            page={account}
            onNavigate={openAccount}
            onSignedIn={handleSignedIn}
            notice={loginReturn.current?.notice}
            onOpenChat={(id) => {
              track('history_chat_open')
              openChat(id)
            }}
            onHome={goHome}
          />
        </Suspense>
      ) : opening ? (
        <ChatSkeleton />
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
          onNewRepo={goHome}
        />
      )}
      {nudging && !confirmingLeave && <LoginNudge onLogin={handleNudgeLogin} onClose={closeNudge} />}
      {confirmingLeave && <LeaveDialog onStay={handleStay} onLeave={handleLeave} />}
      <Toast />
    </div>
  )
}
