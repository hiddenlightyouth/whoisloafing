import { useEffect, useState } from 'react'
import { track } from '../lib/analytics'
import { APP_LOGIN_EVENT, postToApp, type AppLoginDetail } from '../lib/app'
import { signInWithAppCode } from '../lib/auth'
import { AuthForm } from './AuthForm'

type Mode = 'welcome' | 'login' | 'signup'

/** 앱을 켰을 때 로그인하지 않았으면 보여주는 화면이에요. 로그인은 기본 브라우저에서 하고 앱으로 돌아와요. */
export function AppGate() {
  const [mode, setMode] = useState<Mode>('welcome')
  const [waiting, setWaiting] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onLogin = async (event: Event) => {
      const detail = (event as CustomEvent<AppLoginDetail>).detail
      if (!detail?.code || !detail.verifier) return
      setError('')
      setWorking(true)
      const outcome = await signInWithAppCode(detail.code, detail.verifier)
      setWorking(false)
      setWaiting(false)
      track('app_login', { success: outcome.ok })
      if (!outcome.ok) setError(outcome.message)
    }
    window.addEventListener(APP_LOGIN_EVENT, onLogin)
    return () => window.removeEventListener(APP_LOGIN_EVENT, onLogin)
  }, [])

  function openBrowser() {
    track('app_login_browser_click')
    setError('')
    setWaiting(true)
    postToApp({ type: 'login' })
  }

  if (mode !== 'welcome') {
    return (
      <div className="relative flex h-dvh flex-col bg-white">
        <div data-app-drag className="absolute inset-x-0 top-0 h-11" />
        <button
          type="button"
          onClick={() => setMode('welcome')}
          className="absolute top-12 left-5 z-10 h-8 rounded-full px-3 text-[13px] font-medium text-gray-600 transition-colors hover:text-gray-900"
        >
          뒤로
        </button>
        <AuthForm key={mode} mode={mode} onSwitch={() => setMode(mode === 'signup' ? 'login' : 'signup')} />
      </div>
    )
  }

  return (
    <div data-app-drag className="flex h-dvh flex-col items-center justify-center bg-white px-5">
      <div className="w-full max-w-xs text-center">
        <img src="/favicon.svg" alt="" width={64} height={64} draggable={false} className="mx-auto size-16 rounded-2xl border border-gray-200" />
        <h1 className="mt-6 text-[24px] font-semibold leading-snug text-gray-900">WhoIsLoafing</h1>
        <p className="mt-2 break-keep text-[14px] leading-relaxed text-gray-500">
          {waiting ? '브라우저에서 로그인을 마치면 앱으로 돌아와요.' : '로그인하고 우리 프로젝트의 MVP를 찾아보세요.'}
        </p>

        <button
          type="button"
          disabled={working}
          onClick={openBrowser}
          className="mt-8 h-12 w-full rounded-full bg-brand text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:bg-gray-200 disabled:text-gray-400"
        >
          {working ? '처리 중' : waiting ? '브라우저 다시 열기' : '브라우저로 로그인'}
        </button>
        <button
          type="button"
          onClick={() => setMode('login')}
          className="mt-2 h-10 w-full rounded-full text-[13px] font-medium text-gray-600 transition-colors hover:text-gray-900"
        >
          이메일로 로그인
        </button>

        {error && (
          <p role="alert" className="mt-3 animate-rise text-[13px] leading-relaxed text-red-500">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
