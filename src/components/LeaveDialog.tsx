import { useEffect } from 'react'

interface Props {
  /** 메인 화면으로 가려던 것인지. 아니면 다른 화면으로 간다고 안내해요. */
  home: boolean
  onStay: () => void
  onLeave: () => void
  /** 로그인하지 않았을 때만 넘겨요. 있으면 떠나는 대신 로그인하고 이어가도록 권해요. */
  onLogin?: () => void
}

const quiet = 'h-9 rounded-full px-3.5 text-[13px] font-medium text-gray-600 transition-colors hover:text-gray-900'
const primary = 'h-9 rounded-full bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover'

/** 진행 중인 채팅을 두고 헤더의 로고나 링크를 눌렀을 때, 그만두고 이동할지 묻는 창이에요. */
export function LeaveDialog({ home, onStay, onLeave, onLogin }: Props) {
  const place = home ? '메인 화면' : '다른 화면'
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onStay()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onStay])

  return (
    // 바깥의 어두운 부분을 누르면 닫혀요.
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-gray-900/25 px-5 backdrop-blur-[2px]"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onStay()
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="leave-dialog-title"
        className="relative w-full max-w-xs animate-rise rounded-2xl border border-gray-200 bg-white p-5"
      >
        {/* 로그인을 권할 때는 버튼을 둘로 줄이고, 그대로 남는 것은 X 버튼이 맡아요. */}
        {onLogin && (
          <button
            type="button"
            aria-label="닫기"
            onClick={onStay}
            className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-3.5" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <h2 id="leave-dialog-title" className={`text-[15px] font-semibold text-gray-900 ${onLogin ? 'pr-7' : ''}`}>
          {onLogin ? '분석을 잃어버리지 마세요' : '작업을 잃어버릴 수 있어요'}
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">
          {onLogin
            ? `지금 ${place}으로 이동하면 진행 중인 작업을 되돌릴 수 없어요. 로그인하면 분석 중인 내용을 저장하고, 내 작업에서 언제든 이어갈 수 있어요.`
            : `진행 중인 작업을 그만두고 ${place}으로 이동할까요? 이 작업은 되돌릴 수 없어요.`}
        </p>
        {onLogin ? (
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onLeave} className={quiet}>
              괜찮아요
            </button>
            <button type="button" autoFocus onClick={onLogin} className={primary}>
              저장하기
            </button>
          </div>
        ) : (
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onStay} className={quiet}>
              계속 분석하기
            </button>
            <button type="button" autoFocus onClick={onLeave} className={primary}>
              그만두고 이동
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
