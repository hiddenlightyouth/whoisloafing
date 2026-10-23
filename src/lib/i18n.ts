/**
 * 화면 문구의 언어를 정해요. 한국어와 영어를 지원해요.
 * 직접 고른 언어(localStorage)가 있으면 그것을, 없으면 브라우저 언어가 한국어일 때만 한국어를, 그 밖에는 영어를 써요.
 * 주소가 /en으로 시작하면 이번 방문은 영어로 보여줘요. 소개와 아티클, 메인 화면은 영어 주소(/en, /en/about, /en/articles/...)가 따로 있어요.
 * 문구는 화면 파일마다 `messages({ ko, en })`로 모아 두고 `useMessages`로 꺼내 써요.
 */
import { stripApp, withApp } from './shell'
import { readItem, writeItem } from './storage'
import { createStore, useStore } from './store'

export type Lang = 'ko' | 'en'

export const LANGS: Lang[] = ['ko', 'en']

/** 언어를 고르는 칸에 보여주는 이름. 각 언어로 적어요. */
export const LANG_NAMES: Record<Lang, string> = { ko: '한국어', en: 'English' }

const KEY = 'whoisloafing:lang'
const EN_PREFIX = /^\/en(?=\/|$)/

/** 언어마다 주소가 따로 있는 화면이에요. 그 밖의 화면(채팅, 계정 등)은 언어와 상관없이 같은 주소예요. */
const LOCALIZED = /^\/(?:about|articles(?:\/[^/]+)?)?\/?$/

/** 주소 앞의 /en을 떼요. 화면을 고를 때는 이 값을 봐요. */
export const stripLocale = (path: string) => path.replace(EN_PREFIX, '') || '/'

/** 지금 주소에서 언어 표시(/en)와 웹 앱 표시(/app)를 뗀 경로 */
export const currentPath = () => stripApp(stripLocale(window.location.pathname))

/**
 * 이 경로를 주어진 언어의 주소로 바꿔요. 언어마다 주소가 따로 없는 화면은 그대로 둬요.
 * 웹의 /app에서는 소개와 아티클을 뺀 화면에 /app을 붙이고, 언어 표시는 붙이지 않아요.
 */
export function localizePath(path: string, lang: Lang = current.get()): string {
  const bare = stripApp(stripLocale(path))
  const inApp = withApp(bare)
  if (inApp !== bare) return inApp
  if (lang !== 'en' || !LOCALIZED.test(bare)) return bare
  return bare === '/' ? '/en' : `/en${bare}`
}

function stored(): Lang | null {
  const value = readItem(KEY)
  return value === 'ko' || value === 'en' ? value : null
}

/** 브라우저 언어가 한국어면 한국어, 그 밖에는 영어예요. */
export function detectLang(): Lang {
  if (typeof navigator === 'undefined') return 'ko'
  const list = navigator.languages?.length ? navigator.languages : [navigator.language]
  return list.some((code) => /^ko\b/i.test(code ?? '')) ? 'ko' : 'en'
}

function initial(): Lang {
  // 빌드할 때 미리 그리는 화면은 한국어가 기본이고, 영어 화면은 setLang으로 바꿔서 그려요.
  if (typeof window === 'undefined') return 'ko'
  return EN_PREFIX.test(window.location.pathname) ? 'en' : (stored() ?? detectLang())
}

const current = createStore<Lang>(initial())

export const getLang = current.get

/**
 * 언어를 바꿔요. 직접 고른 것이면 이 기기에 저장해서 다음에도 그 언어로 보여줘요.
 * 언어마다 주소가 따로 있는 화면에 있으면 주소도 그 언어의 주소로 바꿔요.
 */
export function setLang(lang: Lang, { persist = true } = {}) {
  if (persist) writeItem(KEY, lang)
  if (lang === current.get()) return
  current.set(lang)
  if (typeof window !== 'undefined') {
    document.documentElement.lang = lang
    const next = localizePath(window.location.pathname, lang)
    if (next !== window.location.pathname) window.history.replaceState(window.history.state, '', next + window.location.search + window.location.hash)
  }
}

export function useLang(): Lang {
  return useStore(current)
}

/** 화면 파일의 문구 묶음이에요. 영어 문구는 한국어와 같은 모양이어야 해서, 빠뜨리면 타입 검사에서 걸려요. */
export function messages<T>(table: { ko: T; en: NoInfer<T> }): Record<Lang, T> {
  return table
}

export function useMessages<T>(table: Record<Lang, T>): T {
  return table[useLang()]
}

/** 컴포넌트 밖(토스트, 오류 문구 등)에서 지금 언어의 문구를 꺼내요. */
export function pick<T>(table: Record<Lang, T>): T {
  return table[current.get()]
}

if (typeof window !== 'undefined') {
  document.documentElement.lang = current.get()
  // 영어로 보여줄 화면인데 한국어 주소로 들어왔으면, 공유할 때 영어 카드가 뜨도록 영어 주소로 바꿔 둬요.
  const next = localizePath(window.location.pathname)
  if (next !== window.location.pathname) window.history.replaceState(null, '', next + window.location.search + window.location.hash)
}
