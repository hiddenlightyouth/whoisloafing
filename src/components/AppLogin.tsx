import { useEffect, useState } from 'react'
import { track } from '../lib/analytics'
import { APP_CALLBACK_URL } from '../lib/app'
import { createAppLoginCode, useAuth } from '../lib/auth'
import { AuthForm } from './AuthForm'
import { messages, pick, useLang, useMessages } from '../lib/i18n'
import { HOME_META, SITE_TITLE } from '../lib/meta'

const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/
const STATE_PATTERN = /^[A-Za-z0-9_-]{1,100}$/

/** PERMISSIONS는 앱의 세션으로 할 수 있는 일이에요. 브라우저에서 로그인했을 때와 같아요. */
const TEXT = messages({
  ko: {
    pageTitle: '앱 로그인',
    PERMISSIONS: ['이름과 이메일 같은 내 계정 정보 보기', '내 작업을 보고 이어서 분석하기', '채팅을 공유하고, 공유를 취소하고, 지우기'],
    handOverFailed: '앱으로 로그인을 넘기지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
    invalid: '앱 로그인 주소가 올바르지 않아요.',
    invalidHint: '앱에서 브라우저로 로그인을 다시 눌러 주세요.',
    sent: '연결되었습니다',
    title: (name: string) => `${name ? `${name}으로 ` : ''}Lofy 앱에서 계속합니다`,
    sentBody: '앱이 실행되면 이 브라우저는 닫아도 괜찮아요.',
    currentAccount: '지금 로그인한 계정',
    working: '처리 중',
    reopen: '앱이 열리지 않았나요?',
    proceed: '계속하기',
    cancel: '취소',
  },
  en: {
    pageTitle: 'App sign-in',
    PERMISSIONS: ['See your account info, like your name and email', 'See your chats and keep analyzing', 'Share chats, stop sharing, and delete them'],
    handOverFailed: "Couldn't pass the sign-in to the app. Please try again in a moment.",
    invalid: 'This app sign-in link is invalid.',
    invalidHint: 'Click Sign in with browser in the app again.',
    sent: 'Connected',
    title: (name: string) => `Continue in the Lofy app${name ? ` as ${name}` : ''}`,
    sentBody: 'Once the app opens, you can close this browser window.',
    currentAccount: 'Your current account',
    working: 'Working',
    reopen: "App didn't open?",
    proceed: 'Continue',
    cancel: 'Cancel',
  },
})

/** 앱이 브라우저로 열어 준 화면이에요. 여기서 로그인하고 허락하면 일회용 코드를 들고 앱으로 돌아가요. */
export function AppLogin({ onCancel }: { onCancel: () => void }) {
  const { tokens, me } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [working, setWorking] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const lang = useLang()
  const text = useMessages(TEXT)

  const [params] = useState(() => new URLSearchParams(window.location.search))
  const challenge = params.get('challenge') ?? ''
  const state = params.get('state') ?? ''
  const valid = CHALLENGE_PATTERN.test(challenge) && STATE_PATTERN.test(state)

  useEffect(() => {
    document.title = `${TEXT[lang].pageTitle} | ${SITE_TITLE}`
    return () => {
      document.title = HOME_META[lang].title
    }
  }, [lang])

  async function handOver() {
    if (working) return
    setError('')
    setWorking(true)
    const code = await createAppLoginCode(challenge)
    setWorking(false)
    track('app_login_approve', { success: code !== null })
    if (!code) {
      setError(pick(TEXT).handOverFailed)
      return
    }
    setSent(true)
    window.location.href = `${APP_CALLBACK_URL}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
  }

  if (!valid) {
    return (
      <main className="flex flex-1 items-center justify-center px-5 text-center">
        <p className="text-[15px] leading-relaxed text-gray-600">
          {text.invalid}
          <br />
          {text.invalidHint}
        </p>
      </main>
    )
  }

  if (tokens === null) {
    return (
      <AuthForm
        key={mode}
        mode={mode}
        onSwitch={() => setMode(mode === 'signup' ? 'login' : 'signup')}
      />
    )
  }

  const name = me?.name || me?.email || ''

  return (
    <main className="flex flex-1 overflow-y-auto">
      <div className="m-auto w-full max-w-sm px-5 pt-24 pb-16">
        <div className="animate-rise rounded-3xl border border-gray-200 bg-white p-6 sm:p-7">
          <img src="/logo.svg" alt="Lofy" width={1592} height={367} draggable={false} className="h-[14px] w-auto" />

          <h1 className="mt-6 break-keep text-[20px] font-semibold leading-snug text-gray-900">
            {sent ? text.sent : text.title(name)}
          </h1>

          {sent ? (
            <p className="mt-3 break-keep text-[14px] leading-relaxed text-gray-500">
              {text.sentBody}
            </p>
          ) : (
            <>
              <div className="mt-5 flex items-center gap-3 rounded-2xl bg-gray-50 px-3.5 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[14px] font-semibold text-brand-hover">
                  {(name[0] ?? '?').toUpperCase()}
                </span>
                <div className="min-w-0">
                  {me?.name && <p className="truncate text-[14px] font-semibold text-gray-900">{me.name}</p>}
                  <p className="truncate text-[13px] text-gray-500">{me?.email ?? text.currentAccount}</p>
                </div>
              </div>

              <ul className="mt-5 space-y-2.5">
                {text.PERMISSIONS.map((permission) => (
                  <li key={permission} className="flex items-start gap-2.5 text-[14px] leading-snug text-gray-700">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true">
                      <path d="M3.5 8.5l3 3 6-6.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="break-keep">{permission}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {error && (
            <p role="alert" className="mt-4 animate-rise text-[13px] leading-relaxed text-red-500">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={working}
            onClick={() => void handOver()}
            className={
              sent
                ? 'mt-5 h-10 w-full rounded-full text-[13px] font-medium text-gray-600 transition-colors hover:text-gray-900 disabled:text-gray-400'
                : 'mt-7 h-12 w-full rounded-full bg-brand text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:bg-gray-200 disabled:text-gray-400'
            }
          >
            {working ? text.working : sent ? text.reopen : text.proceed}
          </button>
          {!sent && (
            <button
              type="button"
              onClick={() => {
                track('app_login_cancel')
                onCancel()
              }}
              className="mt-1.5 h-10 w-full rounded-full text-[13px] font-medium text-gray-600 transition-colors hover:text-gray-900"
            >
              {text.cancel}
            </button>
          )}
        </div>

      </div>
    </main>
  )
}
