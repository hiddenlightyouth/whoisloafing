import { useSyncExternalStore } from 'react'
import { appShell, isApp, postToApp, type AppTheme } from './app'

const THEME_STORAGE = 'whoisloafing:app-theme'
const SHIELD_STORAGE = 'whoisloafing:app-capture-shield'
/** 앱의 설정 창에서 화면 설정을 바꾸면 웹뷰에 보내는 이벤트예요. */
const SETTINGS_EVENT = 'whoisloafing:app-settings'

const THEMES: AppTheme[] = ['system', 'light', 'dark']

export interface AppSettings {
  /** 화면 모드 */
  theme: AppTheme
  /** 화면 공유나 녹화가 감지되면 화면을 가릴지. 처음에는 켜져 있어요. */
  shield: boolean
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
  return { theme: theme && THEMES.includes(theme) ? theme : 'system', shield: read(SHIELD_STORAGE) !== '0' }
}

let settings: AppSettings = appShell ? readSettings() : { theme: 'light', shield: false }
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
    localStorage.setItem(SHIELD_STORAGE, next.shield ? '1' : '0')
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

/** 화면 공유 중에 화면을 가릴지 정하고 앱에도 알려서, 앱의 설정 창과 같이 바뀌게 해요. */
export function setAppShield(shield: boolean) {
  store({ ...settings, shield })
  postToApp({ type: 'shield', on: shield })
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

// 화면 설정은 앱 화면(macOS 앱, 웹의 /app)에서만 써요. 소개와 아티클은 늘 밝은 화면이에요.
if (appShell) {
  apply()
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply)
}
if (isApp) {
  window.addEventListener(SETTINGS_EVENT, (event) => {
    const detail = (event as CustomEvent<Partial<AppSettings>>).detail ?? {}
    store({
      theme: detail.theme && THEMES.includes(detail.theme) ? detail.theme : settings.theme,
      shield: typeof detail.shield === 'boolean' ? detail.shield : settings.shield,
    })
  })
}
