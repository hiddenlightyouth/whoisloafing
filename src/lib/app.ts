/** macOS 앱의 웹뷰는 User-Agent 끝에 WhoIsLoafingApp/버전을 붙여요. 앱 안에서 열렸을 때만 앱 화면을 보여줘요. */
export const isApp = typeof navigator !== 'undefined' && /WhoIsLoafingApp\//.test(navigator.userAgent)

/** 앱이 로그인 코드를 받아 왔을 때 웹뷰에 보내는 이벤트예요. */
export const APP_LOGIN_EVENT = 'whoisloafing:app-login'

/** 브라우저가 앱을 다시 열 때 쓰는 주소예요. */
export const APP_CALLBACK_URL = 'whoisloafing://auth'

export interface AppLoginDetail {
  code: string
  verifier: string
}

/** login은 기본 브라우저로 로그인 화면을 열고, drag와 zoom은 창을 옮기거나 키워요. */
type AppMessage = { type: 'login' } | { type: 'drag' } | { type: 'zoom' }

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
