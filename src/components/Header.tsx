import { Logo } from './Logo'

export function Header({ onHome }: { onHome: () => void }) {
  return (
    <header className="absolute inset-x-0 top-0 z-10 flex h-14 items-center bg-white/70 px-4 backdrop-blur-md sm:px-6">
      <Logo onClick={onHome} />
    </header>
  )
}
