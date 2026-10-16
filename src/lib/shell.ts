/**
 * 지금 화면을 앱처럼(왼쪽 사이드바와 오른쪽 화면) 보여줄지 정해요. 다른 모듈을 불러오지 않아서 가장 먼저 읽혀요.
 * macOS 앱의 웹뷰이거나, 브라우저에서 /app으로 들어왔으면 앱 화면이에요.
 * 브라우저의 메인 주소(/)는 소개 화면이고, 분석과 채팅, 계정 화면은 모두 /app 아래에 있어요.
 */

const browser = typeof window !== 'undefined'

/** macOS 앱의 웹뷰는 User-Agent 끝에 WhoIsLoafingApp/버전을 붙여요. */
export const isApp = typeof navigator !== 'undefined' && /WhoIsLoafingApp\//.test(navigator.userAgent)

const APP_PREFIX = /^\/app(?=\/|$)/

/** 웹에서는 /app 아래에서만 여는 화면이에요. 예전 주소(/c/아이디, /login 등)로 들어오면 /app을 붙여서 열어요. */
const APP_ROUTES = /^\/(?:c|login|signup|me|history|deep|portfolio|explore|admin)(?=\/|$)/

if (browser && !isApp) {
  const { pathname, search, hash } = window.location
  if (APP_ROUTES.test(pathname)) window.history.replaceState(null, '', `/app${pathname}${search}${hash}`)
  // 소개 화면은 이제 메인 주소에 있어요. 예전 소개 주소로 들어오면 메인 주소로 옮겨요.
  else if (/^\/about\/?$/.test(pathname)) window.history.replaceState(null, '', `/${search}${hash}`)
  else if (/^\/en\/about\/?$/.test(pathname)) window.history.replaceState(null, '', `/en${search}${hash}`)
}

/** 브라우저에서 /app으로 들어와서 앱처럼 쓰고 있는지 */
export const isWebApp = browser && !isApp && APP_PREFIX.test(window.location.pathname)

/** 앱 화면(사이드바와 오른쪽 화면)으로 보여줄지. macOS 앱이거나 웹의 /app이에요. */
export const appShell = isApp || isWebApp

/** 주소 앞의 /app을 떼요. 화면을 고를 때는 이 값을 봐요. */
export const stripApp = (path: string) => (isWebApp ? path.replace(APP_PREFIX, '') || '/' : path)

/** 웹의 /app에서 쓰는 주소로 바꿔요. 소개와 아티클은 /app 밖에 있어서 그대로 둬요. */
export function withApp(path: string): string {
  if (!isWebApp || /^\/(?:about|articles)(?=\/|$)/.test(path)) return path
  return path === '/' ? '/app' : `/app${path}`
}
