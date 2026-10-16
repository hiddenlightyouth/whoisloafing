import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import type { AdminTab } from './components/Admin'
import type { ExploreCategory } from './components/Explore'
import { AppFrame, AppSignedOut, useSidebarOpen } from './components/AppFrame'
import { Chat, ChatMissing } from './components/Chat'
import { ChatOverlays } from './components/ChatOverlays'
import { ChatSkeleton, ExploreSkeleton } from './components/Skeleton'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { LeaveDialog } from './components/LeaveDialog'
import { PageView } from './components/PageView'
import { ShortcutTip } from './components/Shortcuts'
import { Toast } from './components/Toast'
import { useAnalysis } from './hooks/useAnalysis'
import { useLoginNudge } from './hooks/useLoginNudge'
import { useScreen } from './hooks/useScreen'
import { useServerConfig } from './hooks/useServerConfig'
import { initAnalytics, repoLabel, track, trackPageView } from './lib/analytics'
import { shareChat } from './lib/api'
import { appShell, isApp, isMac, MAC_DOWNLOAD_OPEN } from './lib/app'
import './lib/theme'
import { claimChats, isAdmin, loadMe, useAuth } from './lib/auth'
import { socialFromPath } from './lib/social'
import { useFeedback } from './lib/feedback'
import { useShortcuts } from './lib/shortcuts'
import { showToast } from './lib/toast'
import { localizePath, messages, pick, useLang } from './lib/i18n'
import { applyMeta, HOME_META } from './lib/meta'
import { chatIdFromPath } from './lib/routes'
import type { AccountPage } from './components/Account'

// 소셜 로그인에서 돌아온 화면과 탐색 목록은 필요할 때만 받아요. 탐색 목록은 앱의 새 분석 화면에서만 쓰여요.
const SocialCallback = lazy(() => import('./components/Social').then((module) => ({ default: module.SocialCallback })))
const ExplorePreview = lazy(() => import('./components/Explore').then((module) => ({ default: module.ExplorePreview })))

async function copyLink(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(window.location.href)
    return true
  } catch {
    return false
  }
}

const TEXT = messages({
  ko: {
    loginToShare: '로그인하면 공유하려던 채팅으로 바로 돌아가요.',
    loginToContinue: '로그인하면 분석하던 채팅으로 바로 돌아가요.',
    sharedCopied: '공유했어요. 링크를 복사했어요.',
    sharedCopyManually: '공유했어요. 링크 복사를 눌러 링크를 가져가세요.',
  },
  en: {
    loginToShare: "Sign in and we'll bring you right back to the chat you wanted to share.",
    loginToContinue: "Sign in and we'll bring you right back to your analysis.",
    sharedCopied: 'Shared. The link is copied.',
    sharedCopyManually: 'Shared. Tap Copy link to grab the link.',
  },
})

/** 헤더에서 갈 수 있는 곳. 아티클은 목록으로 가요. */
type LeaveTarget = 'home' | 'about' | 'articles' | AccountPage

export default function App() {
  const analysis = useAnalysis()
  const { messages, busy, paused, send, resume, stop, abandon, reset, settle, chatId } = analysis

  // 화면을 처음 맞추기 전에 분석 도구를 켜 둬요.
  useEffect(() => {
    initAnalytics()
    void loadMe()
  }, [])

  const config = useServerConfig()
  /** 서버에 채팅 저장 기능이 켜져 있는지 */
  const storage = config?.storage === true
  /** 서버에 심층 분석 API가 있는지. 있을 때만 앱의 사이드바에 심층 분석을 보여줘요. */
  const deep = config?.deep === true
  /** 서버에 탐색 API가 있는지. 있을 때만 앱의 새 분석 화면 아래에 인기 레포를 보여줘요. 아직 물어보는 중이면 null이에요. */
  const exploreReady = config ? config.explore : null

  const { page, setPage, chat, setChat, chatRepo, setChatRepo, opening, missing, loginReturn, goHome, openArticle, openAbout, openAccount, openChat, openAppPage } =
    useScreen(analysis)
  const account = page?.kind === 'account' ? page.page : null
  const article = page?.kind === 'article'

  /** 소셜 로그인에서 돌아온 주소면 어느 서비스인지. 이 화면은 끝나면 페이지를 새로 여니, 처음 한 번만 읽어요. */
  const [social] = useState(socialFromPath)
  const [sidebarOpen, toggleSidebar] = useSidebarOpen()
  /** 사이드바에서 채팅을 지우거나 공유를 바꾸면 올라가요. 심층 분석이 내 작업을 다시 받게 해요. */
  const [chatsVersion, setChatsVersion] = useState(0)
  const { tokens, me } = useAuth()
  const feedback = useFeedback()
  /** 채팅에서 심층 분석으로 넘어갔는지. 그러면 심층 분석의 채팅 버튼 아래에 안내를 잠깐 띄워요. */
  const [deepChatHint, setDeepChatHint] = useState(false)
  /** 진행 중인 채팅을 두고 다른 화면으로 가려고 할 때, 정말 떠날지 묻는 창과 가려던 곳 */
  const [leaveTo, setLeaveTo] = useState<LeaveTarget | null>(null)
  const confirmingLeave = leaveTo !== null
  const loginNudge = useLoginNudge()
  const lang = useLang()

  // 소개와 아티클, 계정 화면은 스스로 제목과 미리보기 태그를 정하고, 그 밖의 화면은 메인 화면의 값을 언어에 맞춰 써요.
  const ownMeta = page?.kind === 'about' || article || account !== null
  useEffect(() => {
    if (!ownMeta) applyMeta(HOME_META[lang], lang, '/')
  }, [ownMeta, lang])

  const handleSubmit = useCallback(
    (url: string) => {
      // 저장 기능이 켜져 있으면 채팅마다 고유한 주소를 만들어서, 새로 고쳐도 다시 열 수 있게 해요.
      const id = storage ? crypto.randomUUID() : null
      if (!reset(id)) return
      if (id) {
        window.history.pushState(null, '', localizePath(`/c/${id}`))
        setChat({ mine: true, shared: false })
      }
      loginNudge.countChat()
      setChatRepo(repoLabel(url))
      track('repo_submit', { repo: repoLabel(url), storage })
      trackPageView('chat', { repo: repoLabel(url), is_owner: true })
      void send({ url }, url.trim())
    },
    [loginNudge, reset, send, setChat, setChatRepo, storage],
  )

  /** 앱의 심층 분석을 열어요. repo(소유자/레포)가 없으면 레포를 고르는 화면이에요. */
  const openDeep = useCallback(
    (repo: string | null, fromChat = false) => {
      setDeepChatHint(fromChat)
      openAppPage(repo ? `/deep/${repo}` : '/deep')
    },
    [openAppPage],
  )

  /** 앱의 포트폴리오 만들기를 열어요. repo(소유자/레포)가 없으면 레포를 고르는 화면이에요. */
  const openPortfolio = useCallback((repo: string | null) => openAppPage(repo ? `/portfolio/${repo}` : '/portfolio'), [openAppPage])

  /** 앱의 탐색 화면을 열어요. 갈래마다 주소가 달라서 뒤로 가기로 앞의 갈래에 돌아가요. */
  const openExplore = useCallback(
    (category: ExploreCategory = 'github') => openAppPage(category === 'github' ? '/explore' : `/explore/${category}`),
    [openAppPage],
  )

  /** 앱의 관리자 화면을 열어요. 탭마다 주소가 달라서 뒤로 가기로 앞의 탭에 돌아가요. */
  const openAdmin = useCallback((tab: AdminTab = 'overview') => openAppPage(tab === 'overview' ? '/admin' : `/admin/${tab}`), [openAppPage])

  // 로그인 화면에서 로그인하면, 보던 채팅이 있으면 그리로 돌아가고 아니면 내 작업으로 가요.
  const [claimWhenIdle, setClaimWhenIdle] = useState(false)
  const handleSignedIn = useCallback(() => {
    // 포트폴리오 주소에서 로그인했으면 그 화면을 그대로 이어서 보여줘요.
    if (page?.kind === 'portfolio') return
    const id = loginReturn.current?.id
    if (!id) {
      // 웹의 /app에서는 내 작업을 사이드바가 보여줘서, 새 분석 화면으로 가요.
      if (appShell) goHome()
      else openAccount('history', true)
      return
    }
    if (id === chatId.current) {
      // 로그인하는 사이에도 돌고 있던 요청은 로그인 전에 보낸 것이라, 끝난 뒤에 계정에 한 번 더 연결해요.
      setClaimWhenIdle(true)
      trackPageView('chat', { is_owner: true })
    }
    openChat(id, true)
  }, [chatId, goHome, loginReturn, openAccount, openChat, page])

  useEffect(() => {
    if (busy || !claimWhenIdle) return
    setClaimWhenIdle(false)
    void claimChats()
  }, [busy, claimWhenIdle])

  const loginFromChat = useCallback(
    (notice: string) => {
      const id = chatId.current
      if (!id) return
      loginReturn.current = { id, notice }
      settle()
      openAccount('login')
    },
    [chatId, loginReturn, openAccount, settle],
  )

  const handleLoginToShare = useCallback(() => loginFromChat(pick(TEXT).loginToShare), [loginFromChat])

  const handleNudgeLogin = useCallback(() => {
    track('login_nudge_click', { busy })
    loginFromChat(pick(TEXT).loginToContinue)
  }, [busy, loginFromChat])

  const handleLeaveLogin = useCallback(() => {
    track('leave_login_click', { busy })
    setLeaveTo(null)
    loginFromChat(pick(TEXT).loginToContinue)
  }, [busy, loginFromChat])

  // 공유된 채팅과 다른 브라우저에서 만든 채팅은 읽기만 할 수 있어요.
  const readOnly = chat !== null && (chat.shared || !chat.mine)
  // 내가 진행 중인 채팅이 화면에 있으면, 떠나기 전에 항상 물어봐요. 분석이 잠깐 멈춰 있을 때(질문을 기다리는 중)도 마찬가지예요.
  const working = busy || (messages.length > 0 && !readOnly)
  const hasBotMessage = messages.some((message) => message.from === 'bot')
  // 로그인하지 않고 분석하는 동안, 첫 말풍선이 나온 뒤에 로그인을 권해요.
  const nudging = storage && tokens === null && !account && !article && !readOnly && hasBotMessage
  // 웹에서 채팅을 보는 Mac 사용자에게는 앱을 권해요. 로그인 안내 카드가 떠 있는 동안에는 자리를 양보해요.
  const appNudging =
    MAC_DOWNLOAD_OPEN && !isApp && isMac && !account && !article && !opening && !missing && hasBotMessage && !(nudging && !loginNudge.closed)

  const go = useCallback(
    (target: LeaveTarget) => {
      if (target === 'home') goHome()
      else if (target === 'about') openAbout()
      else if (target === 'articles') openArticle(null)
      else openAccount(target)
    },
    [goHome, openAbout, openAccount, openArticle],
  )

  // 헤더의 링크는 어느 화면에서나 똑같이 보여주고, 잃어버릴 작업이 있을 때만 떠나기 전에 물어봐요.
  const leaveFor = useCallback(
    (target: LeaveTarget) => {
      // 앱에서 로그인한 상태면 채팅이 내 작업에 남아요. 묻지 않고 바로 옮기고, 돌던 분석은 서버가 끝까지 마쳐서 저장해요.
      // 웹의 /app은 로그인하지 않고도 쓸 수 있어서, 로그인하지 않았으면 웹처럼 떠나기 전에 물어봐요.
      if (appShell && tokens !== null) {
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
    [abandon, busy, go, tokens, working],
  )

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
  }, [abandon, go, leaveTo, loginReturn, messages.length])

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
    showToast((await copyLink()) ? pick(TEXT).sharedCopied : pick(TEXT).sharedCopyManually)
    return true
  }, [chatId, messages.length, setChat])

  const handleCopyLink = useCallback(async () => {
    const ok = await copyLink()
    track('share_link_copy', { success: ok, is_owner: chat?.mine === true })
    return ok
  }, [chat])

  const openDeepFromChat = useCallback((repo: string) => openDeep(repo, true), [openDeep])

  // 앱에서는 로그인부터 해요. 로그인하지 않았으면 다른 화면 대신 로그인 화면만 보여줘요.
  // 앱의 로그인 화면에서는 단축키를 받지 않아요.
  useShortcuts(
    {
      KeyN: handleHome,
      KeyA: appShell ? undefined : () => leaveFor('articles'),
      Slash: () => document.querySelector<HTMLInputElement>('input[data-repo-input]')?.focus(),
      KeyD: appShell && deep ? () => openDeep(null) : undefined,
      KeyT: appShell && exploreReady ? () => openExplore() : undefined,
      KeyB: appShell ? () => toggleSidebar(!sidebarOpen) : undefined,
    },
    !(isApp && tokens === null) && page?.kind !== 'app-login',
  )

  // GitHub나 카카오에서 돌아온 주소면 다른 화면 대신 로그인을 마무리하는 화면만 보여줘요.
  if (social) {
    return (
      <Suspense fallback={<div className="h-dvh bg-white" />}>
        <SocialCallback provider={social} />
      </Suspense>
    )
  }

  if (isApp && tokens === null) return <AppSignedOut />

  const navFrom = account ?? (article ? 'articles' : messages.length > 0 ? 'chat' : 'home')

  const screen = (
    <div className={appShell ? 'relative flex min-w-0 flex-1 flex-col bg-white' : 'relative flex h-dvh flex-col bg-white'}>
      <Header
        app={appShell}
        // 브라우저의 메인 주소는 소개 화면이라, 로고를 누르면 소개 화면으로 가요.
        onHome={appShell ? handleHome : openAbout}
        tryApp={!appShell}
        // 브라우저의 메인 화면(소개)에서만 앱 다운로드 아래에 앱을 권하는 툴팁을 띄워요.
        home={!appShell && page?.kind === 'about'}
        inChat={messages.length > 0 && !readOnly && !account}
        storage={storage}
        busy={busy}
        onStop={stop}
        shared={chat?.shared === true}
        onShare={handleShare}
        onCopyLink={handleCopyLink}
        onLoginToShare={handleLoginToShare}
        onDeep={
          appShell && deep && messages.length > 0 && !account && chatRepo?.includes('/')
            ? () => {
                track('deep_open', { from: 'chat', repo: chatRepo })
                openDeep(chatRepo, true)
              }
            : undefined
        }
        onAbout={
          appShell
            ? () => {
                if (page?.kind === 'about') return
                track('about_nav_click', { from: navFrom })
                leaveFor('about')
              }
            : undefined
        }
        onArticles={() => {
          track('article_nav_click', { from: navFrom })
          leaveFor('articles')
        }}
        signedIn={tokens !== null}
        // 계정 화면은 웹의 /app 안에 있어요. 소개와 아티클 화면에서는 사용해보기 버튼이 대신해요.
        onAccount={appShell ? (next) => {
          // 분석하던 중에 로그인하러 가면 채팅을 들고 가서, 로그인한 뒤에 그대로 이어가요.
          if (next === account && working) return
          if (next === 'login' && working && storage && !account && chatId.current) loginFromChat(pick(TEXT).loginToContinue)
          else leaveFor(next)
        } : undefined}
      />
      {page ? (
        <PageView
          page={page}
          onHome={goHome}
          onDeep={(repo) => openDeep(repo)}
          onPortfolio={openPortfolio}
          onExplore={openExplore}
          onExplorePick={(repo) => {
            setPage(null)
            handleSubmit(`https://github.com/${repo}`)
          }}
          onAdmin={openAdmin}
          onArticle={openArticle}
          onAccount={openAccount}
          onSignedIn={handleSignedIn}
          onOpenChat={openChat}
          loginNotice={loginReturn.current?.notice}
          loginReturnTo={loginReturn.current ? `/c/${loginReturn.current.id}` : undefined}
          chatsVersion={chatsVersion}
          deepChatHint={deepChatHint}
          clubs={config?.clubs === true}
          adminApi={config?.admin === true}
          feedback={feedback.ready}
          signedIn={tokens !== null}
        />
      ) : opening ? (
        <ChatSkeleton />
      ) : missing ? (
        <ChatMissing onHome={handleHome} />
      ) : messages.length === 0 ? (
        <Hero
          onSubmit={handleSubmit}
          below={
            // 탐색이 있는지 아직 모를 때도 뼈대로 자리를 잡아 둬서, 입력창이 가운데에 있다가 위로 튀어 오르지 않게 해요.
            !appShell || exploreReady === false ? undefined : exploreReady ? (
              <Suspense fallback={<ExploreSkeleton />}>
                <ExplorePreview clubs={config?.clubs === true} onMore={openExplore} onPick={(repo) => handleSubmit(`https://github.com/${repo}`)} />
              </Suspense>
            ) : (
              <ExploreSkeleton />
            )
          }
        />
      ) : (
        <Chat messages={messages} busy={busy} paused={paused} readOnly={readOnly} onResume={resume} onSend={send} onHome={handleHome} onNewRepo={goHome} />
      )}
      <ChatOverlays
        messages={messages}
        busy={busy}
        chatId={chatId}
        readOnly={readOnly}
        inAccount={account !== null}
        leaving={confirmingLeave}
        deep={deep}
        chatRepo={chatRepo}
        onDeep={openDeepFromChat}
        nudging={nudging}
        nudgeClosed={loginNudge.closed}
        onNudgeLogin={handleNudgeLogin}
        onNudgeClose={loginNudge.close}
        onNudgeOpen={loginNudge.open}
        appNudging={appNudging}
      />
      {confirmingLeave && (
        <LeaveDialog home={leaveTo === 'home'} onStay={handleStay} onLeave={handleLeave} onLogin={storage && tokens === null && !account ? handleLeaveLogin : undefined} />
      )}
      {isApp && <ShortcutTip />}
      <Toast />
    </div>
  )

  if (!appShell) return screen

  return (
    <AppFrame
      sidebarOpen={sidebarOpen}
      onToggleSidebar={toggleSidebar}
      sidebar={{
        activeChatId: page ? null : chatIdFromPath(),
        page:
          page?.kind === 'deep' || page?.kind === 'portfolio' || page?.kind === 'explore' || page?.kind === 'admin'
            ? page.kind
            : account === 'me'
              ? 'me'
              : article
                ? 'articles'
                : null,
        onDeep: deep ? () => openDeep(null) : undefined,
        onExplore: exploreReady ? () => openExplore() : undefined,
        // 포트폴리오는 내 작업의 채팅으로 만들어서, 로그인했을 때만 보여줘요.
        onPortfolio: config?.portfolio && tokens !== null ? () => openPortfolio(null) : undefined,
        onDeepRepo: deep
          ? (repo) => {
              track('deep_open', { from: 'sidebar', repo })
              openDeep(repo)
            }
          : undefined,
        onAdmin: isAdmin(me) ? () => openAdmin() : undefined,
        refreshKey: `${busy}:${account ?? ''}:${page?.kind === 'deep' ? 'deep' : ''}:${page?.kind === 'portfolio' ? 'portfolio' : ''}:${page?.kind === 'explore' ? 'explore' : ''}:${chatIdFromPath() ?? ''}:${chat?.shared === true}`,
        onNew: handleHome,
        onOpenChat: (id) => {
          if (id === chatId.current && !page) return
          track('history_chat_open', { from: 'sidebar' })
          // 돌던 분석은 서버가 끝까지 마쳐서 저장하니, 기다리지 않고 바로 다른 채팅을 열어요.
          abandon()
          openChat(id)
        },
        onChatChanged: (id, change) => {
          setChatsVersion((value) => value + 1)
          if (id !== chatId.current) return
          if (change === 'unshared') setChat({ mine: true, shared: false })
          else {
            abandon()
            goHome()
          }
        },
        onMe: () => {
          if (account !== 'me') leaveFor('me')
        },
        signedIn: tokens !== null,
        onLogin: () => {
          if (account === 'login') return
          // 분석하던 중에 로그인하러 가면 채팅을 들고 가서, 로그인한 뒤에 그대로 이어가요.
          if (working && storage && !page && chatId.current) loginFromChat(pick(TEXT).loginToContinue)
          else leaveFor('login')
        },
      }}
    >
      {screen}
    </AppFrame>
  )
}
