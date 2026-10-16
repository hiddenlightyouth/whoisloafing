import { useCallback, useEffect, useRef, useState } from 'react'
import type { AccountPage } from '../components/Account'
import { repoLabel, track, trackPageView } from '../lib/analytics'
import { fetchChat } from '../lib/api'
import { appShell } from '../lib/app'
import { localizePath } from '../lib/i18n'
import { chatIdFromPath, isAppOnly, pageFromPath, type Page } from '../lib/routes'
import type { useAnalysis } from './useAnalysis'

/** 지금 보고 있는 채팅의 상태. mine은 이 브라우저에서 만든 채팅인지, shared는 공유됐는지예요. */
export interface ChatState {
  mine: boolean
  shared: boolean
}

/** 채팅에서 로그인 화면으로 갔을 때, 로그인한 뒤에 돌아올 채팅과 로그인 화면에 보여줄 안내 */
export interface LoginReturn {
  id: string
  notice: string
}

type Analysis = Pick<ReturnType<typeof useAnalysis>, 'messages' | 'abandon' | 'reset' | 'load' | 'chatId'>

/** 앱 화면이 아니면 앱 전용 화면을 열지 않아요. */
function initialPage(): Page | null {
  const page = pageFromPath()
  return page && isAppOnly(page) && !appShell ? null : page
}

function trackPage(page: Page) {
  switch (page.kind) {
    case 'about':
    case 'app-login':
      return trackPageView(page.kind)
    case 'deep':
    case 'portfolio':
      return trackPageView(page.kind, { repo: page.repo ?? undefined })
    case 'explore':
      return trackPageView('explore', { category: page.category })
    case 'admin':
      return trackPageView('admin', { tab: page.tab })
    case 'account':
      return trackPageView(page.page)
    case 'article':
      return trackPageView(page.slug ? 'article' : 'articles', { slug: page.slug ?? undefined })
  }
}

/**
 * 지금 보여줄 화면과 보고 있는 채팅을 들고 있어요.
 * 처음 들어왔을 때와 뒤로 가기, 앞으로 가기에서 주소를 읽어 화면을 맞추고, 화면을 옮기는 함수를 돌려줘요.
 */
export function useScreen({ messages, abandon, reset, load, chatId }: Analysis) {
  /** 주소로 여는 화면. null이면 메인 화면이나 채팅이에요. */
  const [page, setPage] = useState(initialPage)
  const [chat, setChat] = useState<ChatState | null>(null)
  /** 보고 있는 채팅의 레포(소유자/레포). 앱에서 이 레포의 심층 분석으로 바로 넘어갈 때 써요. */
  const [chatRepo, setChatRepo] = useState<string | null>(null)
  const [opening, setOpening] = useState(() => chatIdFromPath() !== null)
  const [missing, setMissing] = useState(false)
  const loginReturn = useRef<LoginReturn | null>(null)

  // 주소에 맞는 화면을 준비해요. 처음 들어왔을 때와 뒤로 가기, 앞으로 가기에서 불러요.
  const openFromLocation = useCallback(async () => {
    let next = pageFromPath()
    // 심층 분석, 포트폴리오 만들기, 탐색, 관리자 화면은 앱 화면에서만 써요. 앱 화면이 아닌데 이 주소로 들어오면 메인 화면으로 보내요.
    // 관리자 화면의 권한은 서버가 확인하고, 관리자가 아니면 화면이 안내만 보여줘요.
    if (next && isAppOnly(next) && !appShell) {
      window.history.replaceState(null, '', '/')
      next = null
    }
    setMissing(false)
    setPage(next)
    if (next) {
      // 채팅을 들고 로그인 화면에 와 있는 중이면 채팅을 그대로 둬요.
      const holding = next.kind === 'account' && next.page !== 'me' && next.page !== 'history' && loginReturn.current?.id === chatId.current
      if (!holding) {
        reset()
        setChat(null)
      }
      setOpening(false)
      trackPage(next)
      return
    }
    const id = chatIdFromPath()
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
    setChatRepo(repoLabel(snapshot.repoUrl))
    trackPageView(snapshot.shared ? 'shared_chat' : 'chat', {
      repo: repoLabel(snapshot.repoUrl),
      is_owner: snapshot.owner,
      message_count: snapshot.messages.length,
    })
  }, [chatId, load, reset])

  useEffect(() => {
    void openFromLocation()
    const onPopState = () => void openFromLocation()
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [openFromLocation])

  const account = page?.kind === 'account' ? page.page : null
  const article = page?.kind === 'article'

  const goHome = useCallback(() => {
    // 브라우저의 메인 주소는 소개 화면이라, 새 분석은 /app에서 시작해요. 앱 화면은 처음 열 때 정해져서 페이지를 새로 열어요.
    if (!appShell) {
      window.location.assign('/app')
      return
    }
    if (!reset()) return
    loginReturn.current = null
    track('home_click', { from: account ?? (article ? 'articles' : chat?.shared ? 'shared_chat' : messages.length > 0 ? 'chat' : 'home') })
    setChat(null)
    setMissing(false)
    setPage(null)
    if (window.location.pathname !== localizePath('/')) window.history.pushState(null, '', localizePath('/'))
    trackPageView('home')
  }, [account, article, chat, messages.length, reset])

  /** 아티클 목록(slug가 null)이나 글 하나를 열어요. */
  const openArticle = useCallback(
    (slug: string | null) => {
      if (!reset()) return
      loginReturn.current = null
      setChat(null)
      setMissing(false)
      setPage({ kind: 'article', slug })
      window.history.pushState(null, '', localizePath(slug ? `/articles/${slug}` : '/articles'))
      trackPageView(slug ? 'article' : 'articles', { slug: slug ?? undefined })
    },
    [reset],
  )

  const openAbout = useCallback(() => {
    if (!reset()) return
    loginReturn.current = null
    // 브라우저의 소개 화면은 메인 주소(/)에 있어요.
    window.history.pushState(null, '', localizePath(appShell ? '/about' : '/'))
    void openFromLocation()
  }, [openFromLocation, reset])

  const openAccount = useCallback(
    (next: AccountPage, replace = false) => {
      if (next === 'me' || next === 'history') loginReturn.current = null
      // 채팅을 들고 로그인 화면으로 갈 때는 채팅을 비우지 않아서, 돌던 분석이 뒤에서 그대로 이어져요.
      const holding = loginReturn.current !== null && loginReturn.current.id === chatId.current
      if (!holding) {
        if (!reset()) return
        setChat(null)
      }
      setMissing(false)
      setPage({ kind: 'account', page: next })
      if (replace) window.history.replaceState(null, '', localizePath(`/${next}`))
      else window.history.pushState(null, '', localizePath(`/${next}`))
      trackPageView(next)
    },
    [chatId, reset],
  )

  const openChat = useCallback(
    (id: string, replace = false) => {
      loginReturn.current = null
      if (replace) window.history.replaceState(null, '', localizePath(`/c/${id}`))
      else window.history.pushState(null, '', localizePath(`/c/${id}`))
      void openFromLocation()
    },
    [openFromLocation],
  )

  /** 앱 전용 화면(심층 분석, 포트폴리오 만들기, 탐색, 관리자)을 열어요. 돌던 분석은 서버가 끝까지 마쳐서 저장하니, 기다리지 않고 바로 옮겨요. */
  const openAppPage = useCallback(
    (path: string) => {
      loginReturn.current = null
      abandon()
      window.history.pushState(null, '', localizePath(path))
      void openFromLocation()
    },
    [abandon, openFromLocation],
  )

  return {
    page,
    setPage,
    chat,
    setChat,
    chatRepo,
    setChatRepo,
    opening,
    missing,
    loginReturn,
    goHome,
    openArticle,
    openAbout,
    openAccount,
    openChat,
    openAppPage,
  }
}
