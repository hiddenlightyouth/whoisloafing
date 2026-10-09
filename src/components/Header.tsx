import type { SessionUser } from '../../shared/types'
import { Logo } from './Logo'

interface Props {
  user: SessionUser | null
  authReady: boolean
  onLogout: () => void
  onHome: () => void
}

export function Header({ user, authReady, onLogout, onHome }: Props) {
  return (
    <header className="absolute inset-x-0 top-0 z-10 flex h-14 items-center justify-between bg-white/70 px-4 backdrop-blur-md sm:px-6">
      <Logo onClick={onHome} />

      {/* 로그인은 비공개 레포를 만났을 때 채팅 말풍선에서 안내해요. 여기에는 로그인한 뒤의 상태만 보여줘요. */}
      {authReady && user && (
        <div className="flex items-center gap-3">
          <img src={user.avatarUrl} alt={`${user.login} 프로필`} className="size-7 rounded-full bg-gray-100" />
          <button type="button" onClick={onLogout} className="text-[13px] text-gray-500 hover:text-gray-900">
            로그아웃
          </button>
        </div>
      )}
    </header>
  )
}
