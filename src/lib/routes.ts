import type { AccountPage } from '../components/Account'
import type { AdminTab } from '../components/Admin'
import type { ExploreCategory } from '../components/Explore'
import { currentPath } from './i18n'

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

export const aboutFromPath = () => ABOUT_PATH.test(currentPath())

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

const EXPLORE_PATH = /^\/explore(?:\/(clubs))?\/?$/

/** 탐색 화면 주소면 보고 있는 갈래를 돌려줘요. */
export function exploreFromPath(): ExploreCategory | null {
  const match = EXPLORE_PATH.exec(currentPath())
  return match ? (match[1] ? 'clubs' : 'github') : null
}

const ADMIN_PATH = /^\/admin(?:\/(users|chats|feedback|ai))?\/?$/

/** 관리자 화면 주소면 보고 있는 탭을 돌려줘요. */
export function adminFromPath(): AdminTab | null {
  const match = ADMIN_PATH.exec(currentPath())
  return match ? ((match[1] as AdminTab | undefined) ?? 'overview') : null
}
