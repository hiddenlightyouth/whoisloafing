import { useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { track } from '../lib/analytics'
import { signIn, signUp } from '../lib/auth'
import { SocialButtons, useSocialClients } from './Social'
import { currentPath, localizePath, messages, useMessages } from '../lib/i18n'
import { appShell } from '../lib/app'

const TEXT = messages({
  ko: {
    checkEmail: '이메일 주소를 확인해 주세요.',
    needName: '이름을 적어 주세요.',
    passwordLength: (min: number, max: number) => `비밀번호는 ${min}자 이상 ${max}자 이하로 정해 주세요.`,
    needPassword: '비밀번호를 적어 주세요.',
    mismatch: '비밀번호가 서로 달라요. 다시 확인해 주세요.',
    signup: '회원가입',
    login: '로그인',
    email: '이메일',
    name: '이름',
    namePlaceholder: '홍길동',
    password: '비밀번호',
    passwordCheck: '비밀번호 확인',
    working: '처리 중',
    submitSignup: '가입하기',
    or: '또는',
    haveAccount: '이미 계정이 있나요?',
    noAccount: '아직 계정이 없나요?',
  },
  en: {
    checkEmail: 'Please check your email address.',
    needName: 'Please enter your name.',
    passwordLength: (min: number, max: number) => `Your password must be ${min} to ${max} characters.`,
    needPassword: 'Please enter your password.',
    mismatch: "The passwords don't match. Please check again.",
    signup: 'Sign up',
    login: 'Sign in',
    email: 'Email',
    name: 'Name',
    namePlaceholder: 'Jane Doe',
    password: 'Password',
    passwordCheck: 'Confirm password',
    working: 'Working',
    submitSignup: 'Create account',
    or: 'or',
    haveAccount: 'Already have an account?',
    noAccount: "Don't have an account?",
  },
})

interface Props {
  mode: 'login' | 'signup'
  notice?: string
  onSwitch: () => void
  /** 소셜 로그인을 마치고 돌아갈 주소. 넘기지 않으면 보던 화면이나 내 작업으로 가요. */
  returnTo?: string
}

/** 소셜 로그인을 마치고 돌아갈 주소를 정해요. 앱 로그인, 내 정보, 내 작업처럼 로그인 화면이 대신 떠 있던 주소면 그 주소로 돌아가요. */
function defaultReturn(): string {
  const { pathname, search } = window.location
  const path = currentPath()
  // 웹의 /app에서는 내 작업을 사이드바가 보여줘서 새 분석 화면으로 돌아가요.
  if (path === '/login' || path === '/signup') return appShell ? localizePath('/') : '/history'
  return `${pathname}${search}`
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_MIN = 8
const PASSWORD_MAX = 64
const NAME_MAX = 30

function Field({ label, ...input }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
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

export function AuthForm({ mode, notice, onSwitch, returnTo }: Props) {
  const social = useSocialClients()
  const hasSocial = social !== null && Object.keys(social).length > 0
  const signup = mode === 'signup'
  const text = useMessages(TEXT)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [passwordCheck, setPasswordCheck] = useState('')
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)

  function validate(): string {
    if (!EMAIL_PATTERN.test(email.trim())) return text.checkEmail
    if (signup && !name.trim()) return text.needName
    if (signup && (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX)) {
      return text.passwordLength(PASSWORD_MIN, PASSWORD_MAX)
    }
    if (!password) return text.needPassword
    if (signup && password !== passwordCheck) return text.mismatch
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
        <h1 className="text-[24px] font-semibold leading-snug text-gray-900 sm:text-[28px]">{signup ? text.signup : text.login}</h1>
        {notice && <p className="mt-3 text-[14px] leading-relaxed text-gray-500">{notice}</p>}

        <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
          <Field
            label={text.email}
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
              label={text.name}
              autoComplete="name"
              maxLength={NAME_MAX}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={text.namePlaceholder}
            />
          )}
          <Field
            label={text.password}
            type="password"
            autoComplete={signup ? 'new-password' : 'current-password'}
            maxLength={PASSWORD_MAX}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="********"
          />
          {signup && (
            <Field
              label={text.passwordCheck}
              type="password"
              autoComplete="new-password"
              maxLength={PASSWORD_MAX}
              value={passwordCheck}
              onChange={(event) => setPasswordCheck(event.target.value)}
              placeholder="********"
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
            {working ? text.working : signup ? text.submitSignup : text.login}
          </button>
        </form>

        {hasSocial && (
          <>
            <div className="my-6 flex items-center gap-3 text-[12px] text-gray-400" aria-hidden="true">
              <span className="h-px flex-1 bg-gray-200" />
              {text.or}
              <span className="h-px flex-1 bg-gray-200" />
            </div>
            <SocialButtons mode="login" returnTo={returnTo ?? defaultReturn()} />
          </>
        )}

        <p className="mt-6 text-center text-[13px] text-gray-500">
          {signup ? text.haveAccount : text.noAccount}{' '}
          <a
            href={signup ? '/login' : '/signup'}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
              event.preventDefault()
              onSwitch()
            }}
            className="font-medium text-brand transition-colors hover:text-brand-hover"
          >
            {signup ? text.login : text.signup}
          </a>
        </p>
      </div>
    </main>
  )
}
