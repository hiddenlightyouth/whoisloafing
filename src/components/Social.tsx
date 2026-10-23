import { useEffect, useState } from 'react'
import { track } from '../lib/analytics'
import { loadConfig } from '../lib/api'
import { isApp } from '../lib/app'
import { fetchSocialLinkTarget, type SocialLinkTarget } from '../lib/auth'
import { appLinkFromLocation, finishAppLink, finishSocial, SOCIAL_LABELS, startSocial, startSocialFromApp, type SocialMode, type SocialProvider, type SocialResult } from '../lib/social'
import { showToast } from '../lib/toast'
import { messages, pick, useMessages } from '../lib/i18n'

const TEXT = messages({
  ko: {
    continueWith: (name: string) => `${name}로 계속하기`,
    finishInBrowser: '브라우저에서 연결을 마무리해 주세요.',
    startFailed: '연결을 시작하지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
    canceledInApp: (name: string) => `${name} 로그인을 취소했어요. 앱에서 연결을 다시 눌러 주세요.`,
    checking: (name: string) => `${name}로 계속하는 중...`,
    expired: '연결 요청 시간이 지났어요. 앱에서 연결을 다시 눌러 주세요.',
    linked: '연결했어요',
    linkedBody: (name: string) => `이제 ${name} 계정으로도 로그인할 수 있어요. 이 창을 닫고 앱으로 돌아가면 돼요.`,
    linkFailed: '연결하지 못했어요',
    linkTitle: (name: string) => `${name} 계정을 연결할까요?`,
    linkBody: (name: string) => `아래 계정에 ${name} 계정으로 로그인할 수 있도록 연결합니다`,
    cancel: '취소',
    working: '처리 중',
    link: '연결하기',
    loginFailed: '로그인하지 못했어요',
    backToMe: '내 정보로 돌아가기',
    backToLogin: '로그인 화면으로 돌아가기',
  },
  en: {
    continueWith: (name: string) => `Continue with ${name}`,
    finishInBrowser: 'Finish connecting in your browser.',
    startFailed: "Couldn't start connecting. Please try again in a moment.",
    canceledInApp: (name: string) => `${name} sign-in was canceled. Click Connect in the app again.`,
    checking: (name: string) => `Continuing with ${name}...`,
    expired: 'The connection request expired. Click Connect in the app again.',
    linked: 'Connected',
    linkedBody: (name: string) => `You can now sign in with ${name} too. Close this window and head back to the app.`,
    linkFailed: "Couldn't connect",
    linkTitle: (name: string) => `Connect your ${name} account?`,
    linkBody: (name: string) => `This lets you sign in to the account below with ${name}.`,
    cancel: 'Cancel',
    working: 'Working',
    link: 'Connect',
    loginFailed: "Couldn't sign in",
    backToMe: 'Back to Account',
    backToLogin: 'Back to sign in',
  },
})

/** 서버가 켜 둔 소셜 로그인과 그 공개 값. 아직 모르면 null이에요. */
export function useSocialClients(): Partial<Record<SocialProvider, string>> | null {
  const [clients, setClients] = useState<Partial<Record<SocialProvider, string>> | null>(null)
  useEffect(() => {
    let stale = false
    void loadConfig().then((config) => {
      if (stale) return
      setClients({ ...(config.githubClientId ? { github: config.githubClientId } : {}), ...(config.kakaoClientId ? { kakao: config.kakaoClientId } : {}) })
    })
    return () => {
      stale = true
    }
  }, [])
  return clients
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="size-[18px]" aria-hidden="true">
      <path d="M8 .2a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.93-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.72 1.22 1.88.87 2.33.66.07-.52.28-.87.5-1.07-1.77-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.83-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.52.56.83 1.28.83 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 .2Z" />
    </svg>
  )
}

function KakaoMark() {
  return (
    <svg viewBox="0 0 18 18" fill="currentColor" className="size-[18px]" aria-hidden="true">
      <path d="M9 1.5C4.58 1.5 1 4.3 1 7.76c0 2.23 1.5 4.19 3.75 5.3l-.95 3.47c-.08.3.27.55.54.37l4.16-2.74c.16.01.33.02.5.02 4.42 0 8-2.8 8-6.42S13.42 1.5 9 1.5Z" />
    </svg>
  )
}

const base = 'flex h-12 w-full items-center justify-center gap-2.5 rounded-full text-[15px] font-semibold transition-colors disabled:opacity-60'

interface ButtonsProps {
  mode: SocialMode
  /** 끝나면 돌아갈 주소 */
  returnTo: string
  /** 보여줄 서비스. 넘기지 않으면 서버가 켜 둔 것을 모두 보여줘요. */
  only?: SocialProvider
  /** 버튼 글자. 넘기지 않으면 "GitHub로 계속하기"처럼 적어요. */
  label?: (name: string) => string
}

/**
 * GitHub와 카카오로 가는 버튼이에요. 서버가 켜 둔 서비스만 보여주고, 하나도 없으면 아무것도 그리지 않아요.
 * 카카오 버튼은 카카오의 안내대로 노란 바탕에 검은 글자예요. 메인 컬러 규칙의 예외예요.
 */
export function SocialButtons({ mode, returnTo, only, label: customLabel }: ButtonsProps) {
  const clients = useSocialClients()
  const text = useMessages(TEXT)
  const label = customLabel ?? text.continueWith
  const [going, setGoing] = useState(false)
  if (!clients) return null
  const providers = (['github', 'kakao'] as const).filter((provider) => clients[provider] && (!only || only === provider))
  if (providers.length === 0) return null

  return (
    <div className="space-y-2.5">
      {providers.map((provider) => (
        <button
          key={provider}
          type="button"
          disabled={going}
          onClick={() => {
            setGoing(true)
            track('auth_social_click', { provider, mode, app: isApp })
            if (!isApp) {
              startSocial(provider, clients[provider] ?? '', mode, returnTo)
              return
            }
            // 앱에서는 브라우저가 열려서 거기서 마무리돼요. 이 화면은 그대로 남으니 버튼을 다시 누를 수 있게 풀어요.
            void startSocialFromApp(provider, clients[provider] ?? '').then((opened) => {
              setGoing(false)
              showToast(opened ? pick(TEXT).finishInBrowser : pick(TEXT).startFailed)
            })
          }}
          className={`${base} ${provider === 'kakao' ? '' : 'border border-gray-200 bg-white text-gray-900 hover:border-gray-300'}`}
          style={provider === 'kakao' ? { background: '#FEE500', color: '#191919' } : undefined}
        >
          {provider === 'kakao' ? <KakaoMark /> : <GitHubMark />}
          {label(SOCIAL_LABELS[provider])}
        </button>
      ))}
    </div>
  )
}

// 개발 모드에서는 화면이 두 번 그려져요. 받은 코드는 한 번만 쓸 수 있어서, 요청을 한 번만 보내고 결과를 나눠 써요.
let finishing: Promise<SocialResult> | null = null

const shell = 'flex h-dvh items-center justify-center bg-white px-5'
const primary = 'h-11 rounded-full bg-brand px-6 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:bg-gray-200 disabled:text-gray-400'

/**
 * 앱에서 시작한 계정 연결을 브라우저에서 마무리하는 화면이에요. 어느 계정에 연결하는지 보여주고, 버튼을 눌러야 연결해요.
 * 묻지 않고 연결하면, 남이 보낸 링크를 누르기만 해도 내 소셜 계정이 그 사람의 계정에 묶일 수 있어요.
 */
function AppLink({ provider, ticket, code }: { provider: SocialProvider; ticket: string; code: string | null }) {
  const [target, setTarget] = useState<SocialLinkTarget | null | 'missing'>(null)
  const [state, setState] = useState<'asking' | 'working' | 'done'>('asking')
  const [error, setError] = useState(code ? '' : pick(TEXT).canceledInApp(SOCIAL_LABELS[provider]))
  const label = SOCIAL_LABELS[provider]
  const text = useMessages(TEXT)

  useEffect(() => {
    let stale = false
    void fetchSocialLinkTarget(ticket).then((found) => {
      if (!stale) setTarget(found ?? 'missing')
    })
    return () => {
      stale = true
    }
  }, [ticket])

  async function confirm() {
    if (!code) return
    setState('working')
    const outcome = await finishAppLink(provider, ticket, code)
    track('auth_social', { provider, mode: 'link', app: true, success: outcome.ok })
    if (outcome.ok) setState('done')
    else {
      setError(outcome.message)
      setState('asking')
    }
  }

  if (target === null) {
    return (
      <main className={shell} aria-busy="true">
        <p className="text-[14px] text-gray-500">{text.checking(label)}</p>
      </main>
    )
  }

  const failed = error || (target === 'missing' ? text.expired : '')

  return (
    <main className={shell}>
      <div className="w-full max-w-sm animate-rise text-center">
        {state === 'done' ? (
          <>
            <h1 className="text-[20px] font-semibold text-gray-900">{text.linked}</h1>
            <p className="mt-3 break-keep text-[14px] leading-relaxed text-gray-600">{text.linkedBody(label)}</p>
          </>
        ) : failed ? (
          <>
            <h1 className="text-[20px] font-semibold text-gray-900">{text.linkFailed}</h1>
            <p role="alert" className="mt-3 break-keep text-[14px] leading-relaxed text-gray-600">
              {failed}
            </p>
          </>
        ) : (
          target !== 'missing' && (
            <>
              <h1 className="text-[20px] font-semibold text-gray-900">{text.linkTitle(label)}</h1>
              <p className="mt-3 break-keep text-[14px] leading-relaxed text-gray-600">{text.linkBody(label)}</p>
              <div className="mt-5 rounded-2xl border border-gray-200 px-4 py-3.5 text-left">
                <p className="truncate text-[14.5px] font-semibold text-gray-900">{target.name}</p>
                <p className="mt-0.5 truncate text-[13px] text-gray-500">{target.email}</p>
              </div>
              <div className="mt-7 flex justify-center gap-2">
                <button type="button" onClick={() => window.location.replace('/')} className="h-11 rounded-full px-5 text-[14px] font-medium text-gray-600 transition-colors hover:text-gray-900">
                  {text.cancel}
                </button>
                <button type="button" disabled={state === 'working'} onClick={() => void confirm()} className={primary}>
                  {state === 'working' ? text.working : text.link}
                </button>
              </div>
            </>
          )
        )}
      </div>
    </main>
  )
}

/** GitHub나 카카오에서 돌아온 화면이에요. 받은 코드로 로그인하거나 계정에 연결하고, 원래 가려던 화면으로 보내요. */
export function SocialCallback({ provider }: { provider: SocialProvider }) {
  // 앱에서 시작한 연결이면 확인을 받는 화면을 따로 보여줘요.
  const [appLink] = useState(appLinkFromLocation)
  if (appLink) return <AppLink provider={provider} ticket={appLink.ticket} code={appLink.code} />
  return <BrowserCallback provider={provider} />
}

function BrowserCallback({ provider }: { provider: SocialProvider }) {
  const [failed, setFailed] = useState<SocialResult | null>(null)
  const text = useMessages(TEXT)

  useEffect(() => {
    let stale = false
    finishing ??= finishSocial(provider)
    void finishing.then((result) => {
      track('auth_social', { provider, mode: result.mode, success: result.outcome.ok })
      if (result.outcome.ok) window.location.replace(result.returnTo)
      else if (!stale) setFailed(result)
    })
    return () => {
      stale = true
    }
  }, [provider])

  if (!failed) {
    return (
      <main className="flex h-dvh items-center justify-center bg-white px-5" aria-busy="true">
        <p className="text-[14px] text-gray-500">{text.checking(SOCIAL_LABELS[provider])}</p>
      </main>
    )
  }

  // 앱 로그인을 하던 중이었으면 그 화면으로, 계정에 연결하던 중이었으면 내 정보로 돌아가요.
  const back = failed.mode === 'link' ? '/me' : failed.returnTo.startsWith('/app-login') ? failed.returnTo : '/login'

  return (
    <main className="flex h-dvh items-center justify-center bg-white px-5">
      <div className="w-full max-w-sm animate-rise text-center">
        <h1 className="text-[20px] font-semibold text-gray-900">{failed.mode === 'link' ? text.linkFailed : text.loginFailed}</h1>
        <p role="alert" className="mt-3 break-keep text-[14px] leading-relaxed text-gray-600">
          {failed.outcome.ok ? '' : failed.outcome.message}
        </p>
        <button
          type="button"
          onClick={() => window.location.replace(back)}
          className="mt-7 h-11 rounded-full bg-brand px-6 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover"
        >
          {failed.mode === 'link' ? text.backToMe : text.backToLogin}
        </button>
      </div>
    </main>
  )
}
