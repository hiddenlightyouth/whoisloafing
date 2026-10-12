/** macOS 앱의 웹뷰는 User-Agent 끝에 WhoIsLoafingApp/버전을 붙여요. 앱 안에서 열렸을 때만 앱 화면을 보여줘요. */
export const isApp = typeof navigator !== 'undefined' && /WhoIsLoafingApp\//.test(navigator.userAgent)

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

/** login은 기본 브라우저로 로그인 화면을 열고, drag와 zoom은 창을 옮기거나 키우고, theme과 backdrop은 고른 화면 설정을 앱에 알려요. */
type AppMessage = { type: 'login' } | { type: 'drag' } | { type: 'zoom' } | { type: 'theme'; theme: AppTheme } | { type: 'backdrop'; on: boolean }

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
