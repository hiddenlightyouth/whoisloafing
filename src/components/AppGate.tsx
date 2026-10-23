import { useEffect, useState } from 'react'
import { track } from '../lib/analytics'
import { APP_LOGIN_EVENT, postToApp, type AppLoginDetail } from '../lib/app'
import { signInWithAppCode } from '../lib/auth'
import { LofyScript } from './LofyScript'
import { messages, useMessages } from '../lib/i18n'

const TEXT = messages({
  ko: { waiting: '브라우저 로그인 완료를 기다리는 중', working: '처리 중', reopen: '로그인 페이지가 열리지 않았나요?', login: '브라우저로 로그인' },
  en: { waiting: 'Waiting for you to finish signing in in the browser', working: 'Working', reopen: "Sign-in page didn't open?", login: 'Sign in with browser' },
})

/** 앱을 켰을 때 로그인하지 않았으면 보여주는 화면이에요. 로그인은 기본 브라우저에서 하고 앱으로 돌아와요. */
export function AppGate() {
  const [waiting, setWaiting] = useState(false)
  const text = useMessages(TEXT)
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
      <div className="relative w-full max-w-xs text-center">
        <LofyScript className="mx-auto h-24 w-auto" />
        {/* 브라우저를 열어 둔 동안에만 한 줄로 알려줘요. 그 전에는 로고와 버튼만 둬요. */}
        {waiting && <p className="mt-4 animate-rise break-keep text-[14px] leading-relaxed text-gray-500">{text.waiting}</p>}

        <div className="animate-rise" style={{ animationDelay: '240ms' }}>
          <button
            type="button"
            disabled={working}
            onClick={openBrowser}
            className="mt-8 h-12 w-full rounded-full bg-brand text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:bg-gray-200 disabled:text-gray-400"
          >
            {working ? text.working : waiting ? text.reopen : text.login}
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
