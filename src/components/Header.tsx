import type { SessionUser } from '../../shared/types'
import { LOGIN_URL } from '../lib/api'
import { Logo } from './Logo'

interface Props {
  user: SessionUser | null
  authReady: boolean
  onLogout: () => void
  onHome: () => void
}

export function Header({ user, authReady, onLogout, onHome }: Props) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between px-4 sm:px-6">
      <Logo onClick={onHome} />

      {authReady &&
        (user ? (
          <div className="flex items-center gap-3">
            <img src={user.avatarUrl} alt={`${user.login} 프로필`} className="size-7 rounded-full bg-gray-100" />
            <button type="button" onClick={onLogout} className="text-[13px] text-gray-500 hover:text-gray-900">
              로그아웃
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-end gap-0.5 sm:flex-row sm:items-center sm:gap-3">
            <span className="order-2 text-[11px] text-gray-400 sm:order-1 sm:text-xs">
              비공개 레포를 분석할 때만 필요해요
            </span>
            <a href={LOGIN_URL} className="order-1 text-[13px] font-medium text-gray-600 hover:text-brand sm:order-2">
              GitHub로 로그인
            </a>
          </div>
        ))}
    </header>
  )
}
