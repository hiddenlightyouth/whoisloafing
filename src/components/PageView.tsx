import { lazy, Suspense } from 'react'
import type { AccountPage } from './Account'
import type { AdminTab } from './Admin'
import type { ExploreCategory } from './Explore'
import { track } from '../lib/analytics'
import { isApp } from '../lib/app'
import type { Page } from '../lib/routes'

// 앱이 브라우저로 열어 주는 로그인 화면은 필요할 때만 받아요.
const AppLogin = lazy(() => import('./AppLogin').then((module) => ({ default: module.AppLogin })))

// 심층 분석 대시보드는 앱에서만 쓰는 화면이라, 열 때만 받아요.
const Deep = lazy(() => import('./Deep').then((module) => ({ default: module.Deep })))

// 웹의 /app에서는 심층 분석 대신 앱을 권하는 안내를 보여줘요.
const DeepAppOnly = lazy(() => import('./DeepAppOnly').then((module) => ({ default: module.DeepAppOnly })))

// 포트폴리오 만들기도 앱에서만 쓰는 화면이라, 열 때만 받아요.
const Portfolio = lazy(() => import('./Portfolio').then((module) => ({ default: module.Portfolio })))
const Resume = lazy(() => import('./Resume').then((module) => ({ default: module.Resume })))

const Explore = lazy(() => import('./Explore').then((module) => ({ default: module.Explore })))

// 관리자 화면은 앱에서 관리자 계정만 쓰는 화면이라, 열 때만 받아요.
const Admin = lazy(() => import('./Admin').then((module) => ({ default: module.Admin })))

const Account = lazy(() => import('./Account').then((module) => ({ default: module.Account })))

// 소개 화면은 헤더의 소개 링크로 들어올 때만 받아요.
const About = lazy(() => import('./About').then((module) => ({ default: module.About })))

// 아티클 글과 마크다운 변환 코드는 아티클 화면을 열 때만 받아요.
const Articles = lazy(() => import('./Articles').then((module) => ({ default: module.Articles })))

interface Props {
  page: Page
  onHome: () => void
  onDeep: (repo: string | null) => void
  onPortfolio: (repo: string | null) => void
  onExplore: (category?: ExploreCategory) => void
  /** 탐색에서 고른 레포(소유자/레포)로 분석을 시작해요. */
  onExplorePick: (repo: string) => void
  onAdmin: (tab?: AdminTab) => void
  onArticle: (slug: string | null) => void
  onAccount: (page: AccountPage, replace?: boolean) => void
  onSignedIn: () => void
  onOpenChat: (id: string) => void
  /** 로그인 화면에 보여줄 안내와, 로그인한 뒤에 돌아갈 채팅 */
  loginNotice?: string
  loginReturnTo?: string
  /** 사이드바에서 채팅을 지우거나 공유를 바꾸면 올라가요. 심층 분석과 포트폴리오가 내 작업을 다시 받게 해요. */
  chatsVersion: number
  /** 채팅에서 심층 분석으로 넘어왔는지 */
  deepChatHint: boolean
  clubs: boolean
  adminApi: boolean
  feedback: boolean
  /** 로그인했는지. 웹의 /app에서 로그인하지 않고 포트폴리오나 이력서 주소로 들어오면 로그인 화면을 보여줘요. */
  signedIn: boolean
}

/** 채팅과 메인 화면을 뺀, 주소로 여는 화면을 그려요. 화면 코드는 열 때만 받아요. */
export function PageView({
  page,
  onHome,
  onDeep,
  onPortfolio,
  onExplore,
  onExplorePick,
  onAdmin,
  onArticle,
  onAccount,
  onSignedIn,
  onOpenChat,
  loginNotice,
  loginReturnTo,
  chatsVersion,
  deepChatHint,
  clubs,
  adminApi,
  feedback,
  signedIn,
}: Props) {
  // 포트폴리오와 이력서는 내 작업의 채팅으로 만들어서 로그인해야 써요. 로그인하면 이 화면을 이어서 보여줘요.
  const accountPage = page.kind === 'account' ? page.page : (page.kind === 'portfolio' || page.kind === 'resume') && !signedIn ? 'login' : null
  return (
    <Suspense fallback={<main className="flex-1" />}>
      {page.kind === 'app-login' ? (
        <AppLogin onCancel={onHome} />
      ) : page.kind === 'deep' && !isApp ? (
        <DeepAppOnly />
      ) : page.kind === 'deep' ? (
        <Deep repo={page.repo} onOpen={(repo) => onDeep(repo)} onNew={onHome} refreshKey={chatsVersion} chatHint={deepChatHint} />
      ) : page.kind === 'portfolio' && signedIn ? (
        <Portfolio repo={page.repo} onOpen={onPortfolio} onNew={onHome} refreshKey={chatsVersion} />
      ) : page.kind === 'resume' && signedIn ? (
        <Resume onNew={onHome} refreshKey={chatsVersion} />
      ) : page.kind === 'explore' ? (
        <Explore category={page.category} onCategory={onExplore} clubs={clubs} onPick={onExplorePick} />
      ) : page.kind === 'admin' ? (
        <Admin tab={page.tab} onTab={onAdmin} full={adminApi} feedback={feedback} onOpenChat={onOpenChat} />
      ) : page.kind === 'about' ? (
        <About onHome={onHome} />
      ) : page.kind === 'article' ? (
        <Articles slug={page.slug} onOpen={onArticle} onHome={onHome} />
      ) : accountPage ? (
        <Account
          page={accountPage}
          onNavigate={onAccount}
          onSignedIn={onSignedIn}
          notice={loginNotice}
          returnTo={loginReturnTo}
          onOpenChat={(id) => {
            track('history_chat_open')
            onOpenChat(id)
          }}
          onHome={onHome}
        />
      ) : null}
    </Suspense>
  )
}
