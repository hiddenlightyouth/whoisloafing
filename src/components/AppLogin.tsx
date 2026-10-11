import { useEffect, useState } from 'react'
import { track } from '../lib/analytics'
import { APP_CALLBACK_URL } from '../lib/app'
import { createAppLoginCode, useAuth } from '../lib/auth'
import { AuthForm } from './AuthForm'

const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/
const STATE_PATTERN = /^[A-Za-z0-9_-]{1,100}$/

const SITE_TITLE = 'WhoIsLoafing'

/** 앱이 브라우저로 열어 준 화면이에요. 여기서 로그인하고 허락하면 일회용 코드를 들고 앱으로 돌아가요. */
export function AppLogin() {
  const { tokens, me } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [working, setWorking] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const [params] = useState(() => new URLSearchParams(window.location.search))
  const challenge = params.get('challenge') ?? ''
  const state = params.get('state') ?? ''
  const valid = CHALLENGE_PATTERN.test(challenge) && STATE_PATTERN.test(state)

  useEffect(() => {
    document.title = `앱 로그인 | ${SITE_TITLE}`
    return () => {
      document.title = SITE_TITLE
    }
  }, [])

  async function handOver() {
    if (working) return
    setError('')
    setWorking(true)
    const code = await createAppLoginCode(challenge)
    setWorking(false)
    track('app_login_approve', { success: code !== null })
    if (!code) {
      setError('앱으로 로그인을 넘기지 못했어요. 잠시 뒤에 다시 시도해 주세요.')
      return
    }
    setSent(true)
    window.location.href = `${APP_CALLBACK_URL}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
  }

  if (!valid) {
    return (
      <main className="flex flex-1 items-center justify-center px-5 text-center">
        <p className="text-[15px] leading-relaxed text-gray-600">
          앱 로그인 주소가 올바르지 않아요.
          <br />
          앱에서 브라우저로 로그인을 다시 눌러 주세요.
        </p>
      </main>
    )
  }

  if (tokens === null) {
    return (
      <AuthForm
        key={mode}
        mode={mode}
        notice="로그인하면 WhoIsLoafing 앱으로 돌아가요."
        onSwitch={() => setMode(mode === 'signup' ? 'login' : 'signup')}
      />
    )
  }

  return (
    <main className="flex flex-1 overflow-y-auto">
      <div className="m-auto w-full max-w-sm px-5 pt-24 pb-16">
        <h1 className="text-[24px] font-semibold leading-snug text-gray-900 sm:text-[28px]">
          {sent ? '앱으로 돌아가 주세요' : '앱에 로그인할까요?'}
        </h1>
        <p className="mt-3 break-keep text-[14px] leading-relaxed text-gray-500">
          {sent
            ? '앱이 열리면 이 창은 닫아도 돼요. 앱이 열리지 않으면 아래 버튼을 다시 눌러 주세요.'
            : `${me?.email ?? '지금 로그인한'} 계정으로 WhoIsLoafing 앱에 로그인해요. 앱에서 직접 로그인을 누른 게 아니라면 이 창을 닫아 주세요.`}
        </p>

        {error && (
          <p role="alert" className="mt-4 animate-rise text-[13px] leading-relaxed text-red-500">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={working}
          onClick={() => void handOver()}
          className="mt-8 h-12 w-full rounded-full bg-brand text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:bg-gray-200 disabled:text-gray-400"
        >
          {working ? '처리 중' : sent ? '앱 다시 열기' : '앱에서 계속하기'}
        </button>
      </div>
    </main>
  )
}
