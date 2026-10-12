import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { AccountPage } from './components/Account'
import { Chat } from './components/Chat'
import { ChatSkeleton } from './components/Skeleton'
import { Header } from './components/Header'
import { AppNudge } from './components/AppNudge'
import { Hero } from './components/Hero'
import { LeaveDialog } from './components/LeaveDialog'
import { LoginNudge } from './components/LoginNudge'
import { Toast } from './components/Toast'
import { useAnalysis } from './hooks/useAnalysis'
import { initAnalytics, repoLabel, track, trackPageView } from './lib/analytics'
import { fetchChat, fetchConfig, shareChat } from './lib/api'
import { isApp, isMac, MAC_DOWNLOAD_OPEN } from './lib/app'
import './lib/theme'
import { claimChats, loadMe, useAuth } from './lib/auth'
import { useShortcuts } from './lib/shortcuts'
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

const APP_LOGIN_PATH = /^\/app-login\/?$/

const appLoginFromPath = () => APP_LOGIN_PATH.test(window.location.pathname)

const DEEP_PATH = /^\/deep(?:\/([^/]+)\/([^/]+))?\/?$/

/** 심층 분석 주소면 보고 있는 레포(소유자/레포)를 돌려줘요. repo가 null이면 레포를 고르는 화면이에요. */
function deepFromPath(): { repo: string | null } | null {
  const match = DEEP_PATH.exec(window.location.pathname)
  return match ? { repo: match[1] ? `${match[1]}/${match[2]}` : null } : null
}

// 앱에서만 쓰는 화면과, 앱이 브라우저로 열어 주는 로그인 화면은 필요할 때만 받아요.
const AppGate = lazy(() => import('./components/AppGate').then((module) => ({ default: module.AppGate })))
const AppSidebar = lazy(() => import('./components/AppSidebar').then((module) => ({ default: module.AppSidebar })))
const AppLogin = lazy(() => import('./components/AppLogin').then((module) => ({ default: module.AppLogin })))

// 탐색 목록은 앱의 새 분석 화면에서만 쓰여서, 그때만 받아요.
const Explore = lazy(() => import('./components/Explore').then((module) => ({ default: module.Explore })))

// 심층 분석 대시보드는 앱에서만 쓰는 화면이라, 열 때만 받아요.
const Deep = lazy(() => import('./components/Deep').then((module) => ({ default: module.Deep })))

const Account = lazy(() => import('./components/Account').then((module) => ({ default: module.Account })))

// 아티클 글과 마크다운 변환 코드는 아티클 화면을 열 때만 받아요.
const Articles = lazy(() => import('./components/Articles').then((module) => ({ default: module.Articles })))

const SIDEBAR_CLOSED_KEY = 'whoisloafing:app-sidebar-closed'

function sidebarClosed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_CLOSED_KEY) === '1'
  } catch {
    return false
  }
}

const NUDGE_DISMISSED_KEY = 'whoisloafing:login-nudge-dismissed'
/** 좁은 화면에서 로그인 안내를 닫은 뒤, 채팅을 이만큼 새로 시작하면 다시 띄워요. */
const NUDGE_REOPEN_CHATS = 3

/** 로그인 안내를 닫은 뒤에 새로 시작한 채팅 수. 닫은 적이 없으면 null이에요. */
function nudgeChatsSinceClose(): number | null {
  try {
    const value = localStorage.getItem(NUDGE_DISMISSED_KEY)
    return value === null ? null : Number(value) || 0
  } catch {
    return null
  }
}

function storeNudge(chats: number | null) {
  try {
    if (chats === null) localStorage.removeItem(NUDGE_DISMISSED_KEY)
    else localStorage.setItem(NUDGE_DISMISSED_KEY, String(chats))
  } catch {
    // 저장하지 못해도 이번 화면에서는 그대로 동작해요.
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

/** 헤더에서 갈 수 있는 곳. 아티클은 목록으로 가요. */
type LeaveTarget = 'home' | 'articles' | AccountPage

export default function App() {
  const { messages, busy, paused, send, resume, stop, abandon, reset, load, settle, chatId } = useAnalysis()
  /** 서버에 채팅 저장 기능(Supabase)이 켜져 있는지 */
  const [storage, setStorage] = useState(false)
  /** 서버에 심층 분석 API가 있는지. 있을 때만 앱의 사이드바에 심층 분석을 보여줘요. */
  const [deep, setDeep] = useState(false)
  /** 서버에 탐색 API가 있는지. 있을 때만 앱의 새 분석 화면 아래에 인기 레포를 보여줘요. */
  const [exploreReady, setExploreReady] = useState(false)
  /** 앱의 심층 분석 화면을 보고 있는지. repo가 null이면 레포를 고르는 화면이에요. */
  const [deepPage, setDeepPage] = useState(() => (isApp ? deepFromPath() : null))
  /** 사이드바에서 채팅을 지우거나 공유를 바꾸면 올라가요. 심층 분석이 내 작업을 다시 받게 해요. */
  const [chatsVersion, setChatsVersion] = useState(0)
  /** 지금 보고 있는 채팅의 상태. mine은 이 브라우저에서 만든 채팅인지, shared는 공유됐는지예요. */
  const [chat, setChat] = useState<{ mine: boolean; shared: boolean } | null>(null)
  const [opening, setOpening] = useState(() => chatIdFromPath() !== null)
  const [missing, setMissing] = useState(false)
  /** 아티클 화면을 보고 있는지. slug가 null이면 목록이에요. */
  const [article, setArticle] = useState(articleFromPath)
  const [account, setAccount] = useState(accountFromPath)
  /** 앱이 브라우저로 열어 준 앱 로그인 화면(/app-login)을 보고 있는지 */
  const [appLogin, setAppLogin] = useState(appLoginFromPath)
  /** 앱의 사이드바를 펴 뒀는지. 다음에 켰을 때도 그대로 둬요. */
  const [sidebarOpen, setSidebarOpen] = useState(() => !sidebarClosed())
  const { tokens } = useAuth()
  /** 진행 중인 채팅을 두고 다른 화면으로 가려고 할 때, 정말 떠날지 묻는 창과 가려던 곳 */
  const [leaveTo, setLeaveTo] = useState<LeaveTarget | null>(null)
  const confirmingLeave = leaveTo !== null
  /** 채팅에서 로그인 화면으로 갔을 때, 로그인한 뒤에 돌아올 채팅과 로그인 화면에 보여줄 안내 */
  const loginReturn = useRef<{ id: string; notice: string } | null>(null)
  const [nudgeClosed, setNudgeClosed] = useState(() => nudgeChatsSinceClose() !== null)
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
    const nextAppLogin = appLoginFromPath()
    setAppLogin(nextAppLogin)
    if (nextAppLogin) {
      reset()
      setChat(null)
      setOpening(false)
      trackPageView('app-login')
      return
    }
    // 심층 분석은 앱에서만 써요. 브라우저에서 이 주소로 들어오면 메인 화면으로 보내요.
    const nextDeep = deepFromPath()
    if (nextDeep && !isApp) window.history.replaceState(null, '', '/')
    setDeepPage(isApp ? nextDeep : null)
    if (nextDeep && isApp) {
      reset()
      setChat(null)
      setOpening(false)
      trackPageView('deep', { repo: nextDeep.repo ?? undefined })
      return
    }
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
    void fetchConfig().then((config) => {
      setStorage(config.storage)
      setDeep(config.deep)
      setExploreReady(config.explore)
    })
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
      // 좁은 화면에서는 닫아 둔 로그인 안내를 채팅 몇 번마다 다시 띄워요. 넓은 화면에서는 떠 있는 아이콘이 대신해요.
      const closedFor = nudgeChatsSinceClose()
      if (closedFor !== null && !window.matchMedia('(min-width: 768px)').matches) {
        const reopen = closedFor + 1 >= NUDGE_REOPEN_CHATS
        storeNudge(reopen ? null : closedFor + 1)
        if (reopen) setNudgeClosed(false)
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
    setAppLogin(false)
    setDeepPage(null)
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
      setAppLogin(false)
      setDeepPage(null)
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
      setAppLogin(false)
      setDeepPage(null)
        setAccount(page)
      if (replace) window.history.replaceState(null, '', `/${page}`)
      else window.history.pushState(null, '', `/${page}`)
      trackPageView(page)
    },
    [chatId, reset],
  )

  /** 앱의 심층 분석을 열어요. repo(소유자/레포)가 없으면 레포를 고르는 화면이에요. */
  const openDeep = useCallback(
    (repo: string | null) => {
      loginReturn.current = null
      // 돌던 분석은 서버가 끝까지 마쳐서 저장하니, 기다리지 않고 바로 옮겨요.
      abandon()
      window.history.pushState(null, '', repo ? `/deep/${repo}` : '/deep')
      void openFromLocation()
    },
    [abandon, openFromLocation],
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
    storeNudge(0)
  }, [])

  const openNudge = useCallback(() => {
    track('login_nudge_open')
    setNudgeClosed(false)
    storeNudge(null)
  }, [])

  const handleNudgeLogin = useCallback(() => {
    track('login_nudge_click', { busy })
    loginFromChat('로그인하면 분석하던 채팅으로 바로 돌아가요.')
  }, [busy, loginFromChat])

  const handleLeaveLogin = useCallback(() => {
    track('leave_login_click', { busy })
    setLeaveTo(null)
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
    storage && tokens === null && !account && !article && !readOnly && messages.some((message) => message.from === 'bot')
  useEffect(() => {
    if (nudging && !nudgeClosed) track('login_nudge_view')
  }, [nudging, nudgeClosed])
  // 웹에서 채팅을 보는 Mac 사용자에게는 앱을 권해요. 로그인 안내 카드가 떠 있는 동안에는 자리를 양보해요.
  const appNudging =
    MAC_DOWNLOAD_OPEN && !isApp && isMac && !account && !article && !opening && !missing && messages.some((message) => message.from === 'bot') && !(nudging && !nudgeClosed)

  const go = useCallback(
    (target: LeaveTarget) => {
      if (target === 'home') goHome()
      else if (target === 'articles') openArticle(null)
      else openAccount(target)
    },
    [goHome, openAccount, openArticle],
  )

  // 헤더의 링크는 어느 화면에서나 똑같이 보여주고, 잃어버릴 작업이 있을 때만 떠나기 전에 물어봐요.
  const leaveFor = useCallback(
    (target: LeaveTarget) => {
      // 앱에서는 늘 로그인한 상태라 채팅이 내 작업에 남아요. 묻지 않고 바로 옮기고, 돌던 분석은 서버가 끝까지 마쳐서 저장해요.
      if (isApp) {
        abandon()
        go(target)
        return
      }
      if (!working) {
        go(target)
        return
      }
      track('leave_confirm_open', { busy, to: target })
      setLeaveTo(target)
    },
    [abandon, busy, go, working],
  )

  const toggleSidebar = useCallback((open: boolean) => {
    setSidebarOpen(open)
    try {
      if (open) localStorage.removeItem(SIDEBAR_CLOSED_KEY)
      else localStorage.setItem(SIDEBAR_CLOSED_KEY, '1')
    } catch {
      // 저장하지 못해도 이번 화면에서는 그대로 동작해요.
    }
  }, [])

  const handleHome = useCallback(() => leaveFor('home'), [leaveFor])

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
    const target = leaveTo ?? 'home'
    setLeaveTo(null)
    abandon()
    // 채팅을 버리고 가는 것이라, 로그인 화면으로 가더라도 채팅을 들고 가지 않아요.
    loginReturn.current = null
    go(target)
  }, [abandon, go, leaveTo, messages.length])

  const handleStay = useCallback(() => {
    track('leave_cancel')
    setLeaveTo(null)
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

  // 앱에서는 로그인부터 해요. 로그인하지 않았으면 다른 화면 대신 로그인 화면만 보여줘요.
  // 앱의 로그인 화면에서는 단축키를 받지 않아요.
  useShortcuts(
    {
      KeyN: handleHome,
      KeyA: () => leaveFor('articles'),
      Slash: () => document.querySelector<HTMLInputElement>('input[aria-label="GitHub 레포 링크"]')?.focus(),
      KeyD: isApp && deep ? () => openDeep(null) : undefined,
      KeyB: isApp ? () => toggleSidebar(!sidebarOpen) : undefined,
    },
    !(isApp && tokens === null) && !appLogin,
  )

  if (isApp && tokens === null) {
    return (
      <Suspense fallback={<div data-app-drag className="h-dvh bg-white" />}>
        <AppGate />
      </Suspense>
    )
  }

  const screen = (
    <div className={isApp ? 'relative flex min-w-0 flex-1 flex-col bg-white' : 'relative flex h-dvh flex-col bg-white'}>
      <Header
        app={isApp}
        onHome={handleHome}
        home={messages.length === 0 && !article && !account && !appLogin && !deepPage && !opening && !missing}
        inChat={messages.length > 0 && !readOnly && !account}
        storage={storage}
        busy={busy}
        onStop={stop}
        shared={chat?.shared === true}
        onShare={handleShare}
        onCopyLink={handleCopyLink}
        onLoginToShare={handleLoginToShare}
        onArticles={() => {
          track('article_nav_click', { from: account ?? (article ? 'articles' : messages.length > 0 ? 'chat' : 'home') })
          leaveFor('articles')
        }}
        signedIn={tokens !== null}
        onAccount={(page) => {
          // 분석하던 중에 로그인하러 가면 채팅을 들고 가서, 로그인한 뒤에 그대로 이어가요.
          if (page === account && working) return
          if (page === 'login' && working && storage && !account && chatId.current) loginFromChat('로그인하면 분석하던 채팅으로 바로 돌아가요.')
          else leaveFor(page)
        }}
      />
      {appLogin ? (
        <Suspense fallback={<main className="flex-1" />}>
          <AppLogin onCancel={goHome} />
        </Suspense>
      ) : deepPage ? (
        <Suspense fallback={<main className="flex-1" />}>
          <Deep repo={deepPage.repo} onOpen={openDeep} onNew={goHome} refreshKey={chatsVersion} />
        </Suspense>
      ) : article ? (
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
        <Hero
          onSubmit={handleSubmit}
          below={
            isApp && exploreReady ? (
              <Suspense fallback={null}>
                <Explore onPick={(repo) => handleSubmit(`https://github.com/${repo}`)} />
              </Suspense>
            ) : undefined
          }
        />
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
      {nudging && !confirmingLeave && <LoginNudge collapsed={nudgeClosed} onLogin={handleNudgeLogin} onClose={closeNudge} onOpen={openNudge} />}
      {appNudging && !confirmingLeave && <AppNudge raised={nudging} />}
      {confirmingLeave && (
        <LeaveDialog home={leaveTo === 'home'} onStay={handleStay} onLeave={handleLeave} onLogin={storage && tokens === null && !account ? handleLeaveLogin : undefined} />
      )}
      <Toast />
    </div>
  )

  if (!isApp) return screen

  // 앱에서는 왼쪽에 사이드바를 두고, 오른쪽에 웹과 같은 화면을 보여줘요.
  return (
    <div className="relative flex h-dvh bg-white">
      {/* 창 버튼 바로 옆, 늘 같은 자리에 있는 사이드바 접기 버튼이에요. 접어도 펴도 움직이지 않아요. */}
      <button
        type="button"
        aria-label={sidebarOpen ? '사이드바 닫기' : '사이드바 열기'}
        aria-expanded={sidebarOpen}
        onClick={() => toggleSidebar(!sidebarOpen)}
        className="absolute top-0.5 left-[78px] z-30 flex size-7 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-200/70 hover:text-gray-900"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="size-4" aria-hidden="true">
          <rect x="2" y="3" width="12" height="10" rx="2.5" />
          <path d="M6.5 3v10" />
        </svg>
      </button>
      {sidebarOpen && (
        <Suspense fallback={<aside data-app-drag className="w-64 shrink-0 border-r border-gray-200 bg-gray-50" />}>
          <AppSidebar
            activeChatId={account || article || deepPage ? null : chatIdFromPath()}
            page={deepPage ? 'deep' : account === 'me' ? 'me' : article ? 'articles' : null}
            onDeep={deep ? () => openDeep(null) : undefined}
            refreshKey={`${busy}:${account ?? ''}:${deepPage ? 'deep' : ''}:${chatIdFromPath() ?? ''}:${chat?.shared === true}`}
            onNew={handleHome}
            onOpenChat={(id) => {
              if (id === chatId.current && !account && !article && !deepPage) return
              track('history_chat_open', { from: 'sidebar' })
              // 돌던 분석은 서버가 끝까지 마쳐서 저장하니, 기다리지 않고 바로 다른 채팅을 열어요.
              abandon()
              openChat(id)
            }}
            onChatChanged={(id, change) => {
              setChatsVersion((value) => value + 1)
              if (id !== chatId.current) return
              if (change === 'unshared') setChat({ mine: true, shared: false })
              else {
                abandon()
                goHome()
              }
            }}
            onArticles={() => leaveFor('articles')}
            onMe={() => {
              if (account !== 'me') leaveFor('me')
            }}
          />
        </Suspense>
      )}
      {screen}
    </div>
  )
}
