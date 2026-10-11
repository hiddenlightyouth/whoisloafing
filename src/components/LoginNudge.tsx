import { useEffect } from 'react'

interface Props {
  onLogin: () => void
  onClose: () => void
}

const TITLE = '분석을 잃어버리지 마세요'
const DESCRIPTION = '로그인하면 분석 중인 내용을 저장하고, 더 많은 기능을 사용할 수 있는 기회가 주어져요.'
const ACTION = '로그인하고 분석 계속하기'

/**
 * 로그인하지 않고 분석하는 동안 로그인을 권하는 안내예요.
 * 넓은 화면에서는 왼쪽 아래에 작은 카드로 떠 있고, 좁은 화면(768px 미만)에서는 아래에서 올라오는 시트로 보여줘요.
 */
export function LoginNudge({ onLogin, onClose }: Props) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 시트로 화면을 덮는 좁은 화면에서만 Esc로 닫아요.
      if (event.key === 'Escape' && !window.matchMedia('(min-width: 768px)').matches) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <>
      <aside
        aria-labelledby="login-nudge-title"
        className="absolute bottom-6 left-6 z-10 hidden w-[300px] animate-rise rounded-2xl border border-gray-200 bg-white p-4 md:block"
      >
        <button
          type="button"
          aria-label="닫기"
          onClick={onClose}
          className="absolute top-2.5 right-2.5 flex size-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-3.5" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
          </svg>
        </button>
        <h2 id="login-nudge-title" className="pr-7 text-[14px] font-semibold text-gray-900">
          {TITLE}
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">{DESCRIPTION}</p>
        <button
          type="button"
          onClick={onLogin}
          className="mt-3.5 h-9 w-full rounded-full bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover"
        >
          {ACTION}
        </button>
      </aside>

      {/* 바깥의 어두운 부분을 누르면 닫혀요. */}
      <div
        className="sheet-backdrop absolute inset-0 z-30 flex items-end bg-gray-900/25 md:hidden"
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) onClose()
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-sheet-title"
          className="sheet w-full rounded-t-3xl bg-white px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        >
          <div className="mx-auto h-1 w-9 rounded-full bg-gray-200" aria-hidden="true" />
          <h2 id="login-sheet-title" className="mt-5 text-[18px] font-semibold text-gray-900">
            {TITLE}
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-gray-500">{DESCRIPTION}</p>
          <button
            type="button"
            onClick={onLogin}
            className="mt-6 h-12 w-full rounded-2xl bg-brand text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            {ACTION}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="mt-1 h-11 w-full rounded-2xl text-[14px] font-medium text-gray-500 transition-colors hover:text-gray-900"
          >
            나중에 하기
          </button>
        </div>
      </div>
    </>
  )
}
