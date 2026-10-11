import { useEffect, useState } from 'react'
import { track } from '../lib/analytics'
import { APP_LOGIN_EVENT, postToApp, type AppLoginDetail } from '../lib/app'
import { signInWithAppCode } from '../lib/auth'
import { ContributionBackdrop } from './ContributionBackdrop'

/** 앱을 켰을 때 로그인하지 않았으면 보여주는 화면이에요. 로그인은 기본 브라우저에서 하고 앱으로 돌아와요. */
export function AppGate() {
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

  return (
    <main data-app-drag className="relative flex h-dvh items-center justify-center overflow-hidden bg-white px-5">
      <ContributionBackdrop />
      <div className="relative w-full max-w-xs text-center">
        <img
          src="/logo.svg"
          alt="WhoIsLoafing"
          width={3403}
          height={367}
          draggable={false}
          className="mx-auto h-[22px] w-auto animate-rise"
        />
        <p className="mt-4 animate-rise break-keep text-[14px] leading-relaxed text-gray-500" style={{ animationDelay: '120ms' }}>
          {waiting ? '브라우저에서 로그인을 마치면 앱으로 돌아와요.' : '로그인하고 우리 프로젝트의 MVP를 찾아보세요.'}
        </p>

        <div className="animate-rise" style={{ animationDelay: '240ms' }}>
          <button
            type="button"
            disabled={working}
            onClick={openBrowser}
            className="mt-8 h-12 w-full rounded-full bg-brand text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:bg-gray-200 disabled:text-gray-400"
          >
            {working ? '처리 중' : waiting ? '브라우저 다시 열기' : '브라우저로 로그인'}
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-3 animate-rise text-[13px] leading-relaxed text-red-500">
            {error}
          </p>
        )}
      </div>
    </main>
  )
}
