import { useEffect } from 'react'
import { messages, useMessages } from '../lib/i18n'

const TEXT = messages({
  ko: {
    TITLE: '분석을 잃어버리지 마세요',
    DESCRIPTION: '로그인하면 분석 중인 내용을 저장하고, 더 많은 기능을 사용할 수 있는 기회가 주어져요.',
    ACTION: '로그인하여 분석 저장하기',
    open: '로그인 안내 열기',
    close: '닫기',
    later: '나중에 하기',
  },
  en: {
    TITLE: "Don't lose this analysis",
    DESCRIPTION: 'Sign in to save what you are analyzing and unlock more features.',
    ACTION: 'Sign in to save',
    open: 'Open sign-in prompt',
    close: 'Close',
    later: 'Maybe later',
  },
})

interface Props {
  /** 닫아 둔 상태. 넓은 화면에서는 작은 아이콘만 떠 있고, 좁은 화면에서는 아무것도 보여주지 않아요. */
  collapsed: boolean
  onLogin: () => void
  onClose: () => void
  onOpen: () => void
}


/**
 * 로그인하지 않고 분석하는 동안 로그인을 권하는 안내예요.
 * 넓은 화면에서는 왼쪽 아래에 작은 카드로 떠 있고, 좁은 화면(768px 미만)에서는 아래에서 올라오는 시트로 보여줘요.
 * 넓은 화면에서 카드를 닫으면 같은 자리에 로그인 아이콘이 둥둥 떠 있고, 누르면 카드가 다시 열려요.
 */
export function LoginNudge({ collapsed, onLogin, onClose, onOpen }: Props) {
  const { TITLE, DESCRIPTION, ACTION, open, close, later } = useMessages(TEXT)
  useEffect(() => {
    if (collapsed) return
    const onKeyDown = (event: KeyboardEvent) => {
      // 시트로 화면을 덮는 좁은 화면에서만 Esc로 닫아요.
      if (event.key === 'Escape' && !window.matchMedia('(min-width: 768px)').matches) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [collapsed, onClose])

  if (collapsed) {
    return (
      <button
        type="button"
        aria-label={open}
        onClick={onOpen}
        className="nudge-float absolute bottom-6 left-6 z-10 hidden size-11 items-center justify-center rounded-full border border-gray-200 bg-white text-brand transition-colors hover:border-brand hover:bg-brand-soft md:flex"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-5" aria-hidden="true">
          <path d="M11.5 3.5h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3.5 10h8.5M9 6.75 12.25 10 9 13.25" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    )
  }

  return (
    <>
      <aside
        aria-labelledby="login-nudge-title"
        className="absolute bottom-6 left-6 z-10 hidden w-[300px] origin-bottom-left animate-pop rounded-2xl border border-gray-200 bg-white p-4 md:block"
      >
        <button
          type="button"
          aria-label={close}
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
            {later}
          </button>
        </div>
      </div>
    </>
  )
}
