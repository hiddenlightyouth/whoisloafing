import { createStore, useStore } from './store'
import { isApp } from './shell'

/** macOS 앱 안에서 열렸는지와, 웹의 /app까지 포함해서 앱 화면으로 보여줄지는 shell.ts에서 정해요. */
export { appShell, isApp, isWebApp } from './shell'

/** 앱의 버전 (예: 1.1). 앱 안이 아니면 null이에요. */
export const appVersion = typeof navigator !== 'undefined' ? (/WhoIsLoafingApp\/([\d.]+)/.exec(navigator.userAgent)?.[1] ?? null) : null

/** 앱이 이 버전 이상인지. 새로 생긴 앱 기능을 예전 앱에서 숨길 때 써요. */
export function appAtLeast(minimum: string): boolean {
  if (!appVersion) return false
  const have = appVersion.split('.').map(Number)
  const need = minimum.split('.').map(Number)
  for (let index = 0; index < Math.max(have.length, need.length); index += 1) {
    const diff = (have[index] ?? 0) - (need[index] ?? 0)
    if (diff !== 0) return diff > 0
  }
  return true
}

/** macOS 앱 설치 파일. 앱 레포에서 만든 DMG를 `public/download`에 넣어 둬요. 새 버전도 같은 이름으로 덮어써서 주소가 바뀌지 않아요. */
export const MAC_DOWNLOAD = '/download/WhoIsLoafing.dmg'
export const MAC_SUPPORT = 'for Apple Silicon'
/** macOS 앱을 받을 수 있게 열어 뒀는지. false로 바꾸면 헤더의 macOS가 준비 중으로 보이고, 앱을 권하는 툴팁과 안내도 띄우지 않아요. */
export const MAC_DOWNLOAD_OPEN: boolean = true

/** 앱을 깔 수 있는 Mac에서 보고 있는지. iPad는 Mac으로 알려 오기도 해서 터치 여부로 걸러요. */
export const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform) && navigator.maxTouchPoints < 2

/** 앱이 로그인 코드를 받아 왔을 때 웹뷰에 보내는 이벤트예요. */
export const APP_LOGIN_EVENT = 'whoisloafing:app-login'

/** 브라우저가 앱을 다시 열 때 쓰는 주소예요. */
export const APP_CALLBACK_URL = 'whoisloafing://auth'

export interface AppLoginDetail {
  code: string
  verifier: string
}

/** 앱의 화면 모드. system은 macOS 설정을 따라가요. */
export type AppTheme = 'system' | 'light' | 'dark'

/** update는 새 버전이 있는지 확인하는 창을 띄워요(앱 1.1부터). login은 기본 브라우저로 로그인 화면을 열고, drag와 zoom은 창을 옮기거나 키우고, theme과 shield(앱 1.2부터)는 고른 설정을 앱에 알려요. */
type AppMessage =
  | { type: 'login' }
  | { type: 'drag' }
  | { type: 'zoom' }
  | { type: 'theme'; theme: AppTheme }
  | { type: 'shield'; on: boolean }
  | { type: 'update' }

/** 화면 공유나 녹화가 시작되거나 끝나면 앱이 웹뷰에 보내는 이벤트예요(앱 1.2부터). */
const APP_CAPTURE_EVENT = 'whoisloafing:app-capture'

/** 지금 화면이 공유되거나 녹화되고 있는지. 화면을 가리는 막이 뜨기 전에 온 알림도 놓치지 않게 여기서 받아 둬요. */
const captured = createStore(false)

if (isApp) {
  window.addEventListener(APP_CAPTURE_EVENT, (event) => {
    captured.set((event as CustomEvent<{ active?: boolean }>).detail?.active === true)
  })
}

export function useAppCaptured(): boolean {
  return useStore(captured)
}

interface AppBridge {
  webkit?: { messageHandlers?: { whoisloafing?: { postMessage: (message: AppMessage) => void } } }
}

export function postToApp(message: AppMessage) {
  ;(window as unknown as AppBridge).webkit?.messageHandlers?.whoisloafing?.postMessage(message)
}

const DRAG_AREA = '[data-app-drag]'
const NOT_DRAGGABLE = 'a, button, input, textarea, select, [role="menu"], [role="alertdialog"]'

function inDragArea(event: MouseEvent): boolean {
  const target = event.target
  return event.button === 0 && target instanceof Element && target.closest(DRAG_AREA) !== null && target.closest(NOT_DRAGGABLE) === null
}

// 웹뷰는 창의 제목 표시줄까지 덮어서, data-app-drag를 붙인 곳을 잡으면 앱에 알려서 창을 옮겨요.
if (isApp) {
  window.addEventListener('mousedown', (event) => {
    if (event.detail === 1 && inDragArea(event)) postToApp({ type: 'drag' })
  })
  window.addEventListener('dblclick', (event) => {
    if (inDragArea(event)) postToApp({ type: 'zoom' })
  })
}
