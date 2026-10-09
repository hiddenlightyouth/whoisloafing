/**
 * Google Analytics 4 연동이에요. VITE_GA_MEASUREMENT_ID가 있을 때만 켜져요.
 * 화면 곳곳에서 track으로 사용자 행동을 이벤트로 남겨요. 이벤트 이름과 값은 CLAUDE.md에 정리되어 있어요.
 */
const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

type Params = Record<string, string | number | boolean | undefined>

export function initAnalytics(): void {
  if (!MEASUREMENT_ID || window.gtag) return

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer ?? []
  // gtag는 배열이 아니라 arguments 객체를 그대로 쌓아야 해요.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments)
  }
  window.gtag('js', new Date())
  // 한 페이지 앱이라 화면 전환은 trackPageView로 직접 보내요.
  window.gtag('config', MEASUREMENT_ID, { send_page_view: false })
}

export function track(event: string, params: Params = {}): void {
  if (!MEASUREMENT_ID || !window.gtag) return
  window.gtag('event', event, params)
}

const PAGE_TITLES = {
  home: 'WhoIsLoafing',
  chat: 'WhoIsLoafing 분석',
  shared_chat: 'WhoIsLoafing 공유된 분석',
  articles: 'WhoIsLoafing 아티클',
  article: 'WhoIsLoafing 아티클',
}

/** 화면이 바뀔 때마다 불러요. 채팅 ID는 경로에 넣지 않고 따로 보내서 보고서의 경로가 흩어지지 않게 해요. */
export function trackPageView(
  screen: 'home' | 'chat' | 'shared_chat' | 'articles' | 'article',
  params: Params = {},
): void {
  const path =
    screen === 'home' ? '/' : screen === 'articles' ? '/articles' : screen === 'article' ? `/articles/${params.slug}` : '/c/[id]'
  track('page_view', {
    page_path: path,
    page_location: `${window.location.origin}${path}`,
    page_title: PAGE_TITLES[screen],
    screen,
    ...params,
  })
}

/** 주소에서 owner/repo만 뽑아서 이벤트에 남겨요. */
export function repoLabel(url: string): string {
  const match = /(?:github\.com[/:])?([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/i.exec(url.trim())
  return match ? `${match[1]}/${match[2]}` : 'unknown'
}
