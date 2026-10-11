import { useSyncExternalStore } from 'react'
import { isApp, postToApp, type AppTheme } from './app'

const THEME_STORAGE = 'whoisloafing:app-theme'
const BACKDROP_STORAGE = 'whoisloafing:app-backdrop'
/** 앱의 설정 창에서 화면 설정을 바꾸면 웹뷰에 보내는 이벤트예요. */
const SETTINGS_EVENT = 'whoisloafing:app-settings'

const THEMES: AppTheme[] = ['system', 'light', 'dark']

export interface AppSettings {
  /** 화면 모드 */
  theme: AppTheme
  /** 새 분석 화면에 기여도 그래프와 지렁이 배경을 보여줄지 */
  backdrop: boolean
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function readSettings(): AppSettings {
  const theme = read(THEME_STORAGE) as AppTheme | null
  return { theme: theme && THEMES.includes(theme) ? theme : 'system', backdrop: read(BACKDROP_STORAGE) === '1' }
}

let settings: AppSettings = isApp ? readSettings() : { theme: 'light', backdrop: true }
const listeners = new Set<() => void>()

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches

/** html에 dark를 붙이면 index.css가 색 토큰을 어두운 값으로 바꿔요. */
function apply() {
  document.documentElement.classList.toggle('dark', settings.theme === 'dark' || (settings.theme === 'system' && systemDark()))
}

function store(next: AppSettings) {
  settings = next
  try {
    localStorage.setItem(THEME_STORAGE, next.theme)
    localStorage.setItem(BACKDROP_STORAGE, next.backdrop ? '1' : '0')
  } catch {
    // 저장하지 못해도 이번 화면에서는 그대로 동작해요.
  }
  apply()
  listeners.forEach((listener) => listener())
}

/** 화면 모드를 바꾸고 앱에도 알려서, 창과 설정 창이 같이 바뀌게 해요. */
export function setAppTheme(theme: AppTheme) {
  store({ ...settings, theme })
  postToApp({ type: 'theme', theme })
}

export function setAppBackdrop(backdrop: boolean) {
  store({ ...settings, backdrop })
  postToApp({ type: 'backdrop', on: backdrop })
}

export function useAppSettings(): AppSettings {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => settings,
    () => settings,
  )
}

// 화면 설정은 앱에서만 써요. 브라우저로 들어온 화면은 늘 밝은 화면에 배경 그림이 있어요.
if (isApp) {
  apply()
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply)
  window.addEventListener(SETTINGS_EVENT, (event) => {
    const detail = (event as CustomEvent<Partial<AppSettings>>).detail ?? {}
    store({
      theme: detail.theme && THEMES.includes(detail.theme) ? detail.theme : settings.theme,
      backdrop: typeof detail.backdrop === 'boolean' ? detail.backdrop : settings.backdrop,
    })
  })
}
