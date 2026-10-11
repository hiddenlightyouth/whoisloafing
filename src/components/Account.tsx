import { useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { AuthForm } from './AuthForm'
import { History } from './History'
import { MyPage } from './MyPage'

export type AccountPage = 'login' | 'signup' | 'me' | 'history'

interface Props {
  page: AccountPage
  onNavigate: (page: AccountPage, replace?: boolean) => void
  onOpenChat: (id: string) => void
  onHome: () => void
}

const SITE_TITLE = 'WhoIsLoafing'

const TITLES: Record<AccountPage, string> = {
  login: '로그인',
  signup: '회원가입',
  me: '내 정보',
  history: '내 작업',
}

export function Account({ page, onNavigate, onOpenChat, onHome }: Props) {
  const { tokens } = useAuth()
  const signedIn = tokens !== null
  const guarded = page === 'me' || page === 'history'

  useEffect(() => {
    document.title = `${TITLES[page]} | ${SITE_TITLE}`
    return () => {
      document.title = SITE_TITLE
    }
  }, [page])

  useEffect(() => {
    if (signedIn && !guarded) onNavigate('history', true)
  }, [guarded, onNavigate, signedIn])

  if (!signedIn) {
    const mode = page === 'signup' ? 'signup' : 'login'
    return (
      <AuthForm
        key={mode}
        mode={mode}
        notice={page === 'me' ? '내 정보는 로그인한 뒤에 볼 수 있어요.' : page === 'history' ? '내 작업은 로그인한 뒤에 볼 수 있어요.' : undefined}
        onSwitch={() => onNavigate(mode === 'signup' ? 'login' : 'signup')}
      />
    )
  }

  if (page === 'me') return <MyPage onSignedOut={onHome} />
  if (page === 'history') return <History onOpenChat={onOpenChat} onHome={onHome} />
  return <main className="flex-1" />
}
