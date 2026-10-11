import { useEffect, useState } from 'react'
import { track } from '../lib/analytics'
import { APP_CALLBACK_URL } from '../lib/app'
import { createAppLoginCode, useAuth } from '../lib/auth'
import { AuthForm } from './AuthForm'

const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/
const STATE_PATTERN = /^[A-Za-z0-9_-]{1,100}$/

const SITE_TITLE = 'WhoIsLoafing'

/** 앱의 세션으로 할 수 있는 일. 브라우저에서 로그인했을 때와 같아요. */
const PERMISSIONS = ['이름과 이메일 같은 내 계정 정보 보기', '내 작업을 보고 이어서 분석하기', '채팅을 공유하고, 공유를 취소하고, 지우기']

/** 앱이 브라우저로 열어 준 화면이에요. 여기서 로그인하고 허락하면 일회용 코드를 들고 앱으로 돌아가요. */
export function AppLogin({ onCancel }: { onCancel: () => void }) {
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

  const name = me?.name || me?.email || ''

  return (
    <main className="flex flex-1 overflow-y-auto">
      <div className="m-auto w-full max-w-sm px-5 pt-24 pb-16">
        <div className="animate-rise rounded-3xl border border-gray-200 bg-white p-6 sm:p-7">
          <img src="/logo.svg" alt="WhoIsLoafing" width={3403} height={367} draggable={false} className="h-[14px] w-auto" />

          <h1 className="mt-6 break-keep text-[20px] font-semibold leading-snug text-gray-900">
            {sent ? '앱으로 돌아가 주세요' : 'WhoIsLoafing 앱이 내 계정에 접근하려고 해요'}
          </h1>

          {sent ? (
            <p className="mt-3 break-keep text-[14px] leading-relaxed text-gray-500">
              앱이 열리면 이 창은 닫아도 돼요. 앱이 열리지 않으면 아래 버튼을 다시 눌러 주세요.
            </p>
          ) : (
            <>
              <div className="mt-5 flex items-center gap-3 rounded-2xl bg-gray-50 px-3.5 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[14px] font-semibold text-brand-hover">
                  {(name[0] ?? '?').toUpperCase()}
                </span>
                <div className="min-w-0">
                  {me?.name && <p className="truncate text-[14px] font-semibold text-gray-900">{me.name}</p>}
                  <p className="truncate text-[13px] text-gray-500">{me?.email ?? '지금 로그인한 계정'}</p>
                </div>
              </div>

              <p className="mt-6 text-xs font-medium text-gray-400">계속하면 앱에서 할 수 있는 일</p>
              <ul className="mt-2.5 space-y-2.5">
                {PERMISSIONS.map((permission) => (
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
            className="mt-7 h-12 w-full rounded-full bg-brand text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:bg-gray-200 disabled:text-gray-400"
          >
            {working ? '처리 중' : sent ? '앱 다시 열기' : '계속하기'}
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
              취소
            </button>
          )}
        </div>

        {!sent && (
          <p className="mt-4 break-keep px-2 text-center text-xs leading-relaxed text-gray-400">
            앱에서 직접 로그인을 누른 게 아니라면 취소해 주세요. 앱은 내 정보의 로그인한 기기에서 언제든 로그아웃시킬 수 있어요.
          </p>
        )}
      </div>
    </main>
  )
}
