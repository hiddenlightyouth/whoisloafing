import { useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { track } from '../lib/analytics'
import { signIn, signUp } from '../lib/auth'

interface Props {
  mode: 'login' | 'signup'
  notice?: string
  onSwitch: () => void
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_MIN = 8
const PASSWORD_MAX = 64
const NAME_MAX = 30

export function Field({ label, ...input }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-gray-600">{label}</span>
      <input
        {...input}
        className="mt-1.5 h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-base text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-brand sm:text-[14px]"
      />
    </label>
  )
}

export function AuthForm({ mode, notice, onSwitch }: Props) {
  const signup = mode === 'signup'
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [passwordCheck, setPasswordCheck] = useState('')
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)

  function validate(): string {
    if (!EMAIL_PATTERN.test(email.trim())) return '이메일 주소를 확인해 주세요.'
    if (signup && !name.trim()) return '이름을 적어 주세요.'
    if (signup && (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX)) {
      return `비밀번호는 ${PASSWORD_MIN}자 이상 ${PASSWORD_MAX}자 이하로 정해 주세요.`
    }
    if (!password) return '비밀번호를 적어 주세요.'
    if (signup && password !== passwordCheck) return '비밀번호가 서로 달라요. 다시 확인해 주세요.'
    return ''
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (working) return
    const invalid = validate()
    if (invalid) {
      setError(invalid)
      return
    }
    setError('')
    setWorking(true)
    const outcome = signup ? await signUp(email.trim(), name.trim(), password) : await signIn(email.trim(), password)
    setWorking(false)
    track(signup ? 'auth_signup' : 'auth_login', { success: outcome.ok })
    if (!outcome.ok) setError(outcome.message)
  }

  return (
    <main className="flex flex-1 overflow-y-auto">
      <div className="m-auto w-full max-w-sm px-5 pt-24 pb-16">
        <h1 className="text-[24px] font-semibold leading-snug text-gray-900 sm:text-[28px]">{signup ? '회원가입' : '로그인'}</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-gray-500">
          {notice ??
            (signup
              ? '가입하면 분석한 레포를 작업 진행 내역에 모아 두고, 다른 기기에서도 이어서 볼 수 있어요.'
              : '로그인하면 분석한 레포를 작업 진행 내역에서 다시 열 수 있어요.')}
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
          <Field
            label="이메일"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
          />
          {signup && (
            <Field
              label="이름"
              autoComplete="name"
              maxLength={NAME_MAX}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="화면에 보여줄 이름"
            />
          )}
          <Field
            label="비밀번호"
            type="password"
            autoComplete={signup ? 'new-password' : 'current-password'}
            maxLength={PASSWORD_MAX}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={signup ? `${PASSWORD_MIN}자 이상` : ''}
          />
          {signup && (
            <Field
              label="비밀번호 확인"
              type="password"
              autoComplete="new-password"
              maxLength={PASSWORD_MAX}
              value={passwordCheck}
              onChange={(event) => setPasswordCheck(event.target.value)}
            />
          )}

          {error && (
            <p role="alert" className="animate-rise text-[13px] leading-relaxed text-red-500">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={working}
            className="mt-2 h-12 w-full rounded-full bg-brand text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:bg-gray-200 disabled:text-gray-400"
          >
            {working ? (signup ? '가입하고 있어요' : '로그인하고 있어요') : signup ? '가입하기' : '로그인'}
          </button>
        </form>

        <p className="mt-6 text-center text-[13px] text-gray-500">
          {signup ? '이미 계정이 있나요?' : '아직 계정이 없나요?'}{' '}
          <a
            href={signup ? '/login' : '/signup'}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
              event.preventDefault()
              onSwitch()
            }}
            className="font-medium text-brand transition-colors hover:text-brand-hover"
          >
            {signup ? '로그인' : '회원가입'}
          </a>
        </p>
      </div>
    </main>
  )
}
