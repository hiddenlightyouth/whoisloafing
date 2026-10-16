import type { AccountPage } from '../components/Account'
import type { AdminTab } from '../components/Admin'
import type { ExploreCategory } from '../components/Explore'
import { currentPath } from './i18n'
import { appShell } from './shell'

// 주소에서 지금 보여줄 화면을 읽어요. 언어 앞머리(/en)는 떼고 봐요.

const CHAT_PATH = /^\/c\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i

export const chatIdFromPath = () => CHAT_PATH.exec(currentPath())?.[1] ?? null

const ARTICLE_PATH = /^\/articles(?:\/([^/]+))?\/?$/

/** 아티클 주소면 보고 있는 글을 돌려줘요. slug가 null이면 목록이에요. */
export function articleFromPath(): { slug: string | null } | null {
  const match = ARTICLE_PATH.exec(currentPath())
  return match ? { slug: match[1] ?? null } : null
}

const ABOUT_PATH = /^\/about\/?$/

/** 브라우저의 메인 주소(/)는 소개 화면이에요. 앱 화면(macOS 앱, 웹의 /app)의 메인 주소는 새 분석 화면이에요. */
export const aboutFromPath = () => ABOUT_PATH.test(currentPath()) || (!appShell && currentPath() === '/')

const ACCOUNT_PATH = /^\/(login|signup|me|history)\/?$/

export const accountFromPath = () => (ACCOUNT_PATH.exec(currentPath())?.[1] as AccountPage | undefined) ?? null

const APP_LOGIN_PATH = /^\/app-login\/?$/

export const appLoginFromPath = () => APP_LOGIN_PATH.test(currentPath())

const DEEP_PATH = /^\/deep(?:\/([^/]+)\/([^/]+))?\/?$/

/** 심층 분석 주소면 보고 있는 레포(소유자/레포)를 돌려줘요. repo가 null이면 레포를 고르는 화면이에요. */
export function deepFromPath(): { repo: string | null } | null {
  const match = DEEP_PATH.exec(currentPath())
  return match ? { repo: match[1] ? `${match[1]}/${match[2]}` : null } : null
}

const PORTFOLIO_PATH = /^\/portfolio(?:\/([^/]+)\/([^/]+))?\/?$/

/** 포트폴리오 만들기 주소면 고른 레포(소유자/레포)를 돌려줘요. repo가 null이면 레포를 고르는 화면이에요. */
export function portfolioFromPath(): { repo: string | null } | null {
  const match = PORTFOLIO_PATH.exec(currentPath())
  return match ? { repo: match[1] ? `${match[1]}/${match[2]}` : null } : null
}

const RESUME_PATH = /^\/resume\/?$/

/** 이력서 만들기 주소인지 */
export const resumeFromPath = () => RESUME_PATH.test(currentPath())

const PLANS_PATH = /^\/plans\/?$/

/** 요금제와 사용량 주소인지 */
export const plansFromPath = () => PLANS_PATH.test(currentPath())

const EXPLORE_PATH = /^\/explore(?:\/(clubs|global))?\/?$/

/** 탐색 화면 주소면 보고 있는 갈래를 돌려줘요. */
export function exploreFromPath(): ExploreCategory | null {
  const match = EXPLORE_PATH.exec(currentPath())
  return match ? ((match[1] as ExploreCategory | undefined) ?? 'github') : null
}

const ADMIN_PATH = /^\/admin(?:\/(users|chats|feedback|ai))?\/?$/

/** 관리자 화면 주소면 보고 있는 탭을 돌려줘요. */
export function adminFromPath(): AdminTab | null {
  const match = ADMIN_PATH.exec(currentPath())
  return match ? ((match[1] as AdminTab | undefined) ?? 'overview') : null
}

/** 채팅과 메인 화면을 뺀, 주소로 여는 화면. null이면 메인 화면이나 채팅이에요. */
export type Page =
  | { kind: 'about' }
  | { kind: 'app-login' }
  | { kind: 'deep'; repo: string | null }
  | { kind: 'portfolio'; repo: string | null }
  | { kind: 'resume' }
  | { kind: 'plans' }
  | { kind: 'explore'; category: ExploreCategory }
  | { kind: 'admin'; tab: AdminTab }
  | { kind: 'account'; page: AccountPage }
  | { kind: 'article'; slug: string | null }

/** 심층 분석, 포트폴리오 만들기, 이력서 만들기, 탐색, 관리자 화면은 앱 화면(macOS 앱, 웹의 /app)에서만 써요. 심층 분석은 웹의 /app에서 앱을 권하는 안내만 보여줘요. */
export const isAppOnly = (page: Page) => page.kind === 'deep' || page.kind === 'portfolio' || page.kind === 'resume' || page.kind === 'plans' || page.kind === 'explore' || page.kind === 'admin'

/** 주소에서 지금 보여줄 화면을 읽어요. 앱 전용 화면인지는 따지지 않아요. */
export function pageFromPath(): Page | null {
  if (aboutFromPath()) return { kind: 'about' }
  if (appLoginFromPath()) return { kind: 'app-login' }
  const deep = deepFromPath()
  if (deep) return { kind: 'deep', repo: deep.repo }
  const portfolio = portfolioFromPath()
  if (portfolio) return { kind: 'portfolio', repo: portfolio.repo }
  if (resumeFromPath()) return { kind: 'resume' }
  if (plansFromPath()) return { kind: 'plans' }
  const category = exploreFromPath()
  if (category) return { kind: 'explore', category }
  const tab = adminFromPath()
  if (tab) return { kind: 'admin', tab }
  const account = accountFromPath()
  if (account) return { kind: 'account', page: account }
  const article = articleFromPath()
  if (article) return { kind: 'article', slug: article.slug }
  return null
}
