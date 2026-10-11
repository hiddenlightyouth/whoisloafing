import { useEffect } from 'react'

interface Props {
  onStay: () => void
  onLeave: () => void
  /** 로그인하지 않았을 때만 넘겨요. 있으면 떠나는 대신 로그인하고 이어가도록 권해요. */
  onLogin?: () => void
}

/** 분석 중에 로고를 눌렀을 때, 분석을 그만두고 메인 화면으로 갈지 묻는 창이에요. */
export function LeaveDialog({ onStay, onLeave, onLogin }: Props) {
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
        className="w-full max-w-xs animate-rise rounded-2xl border border-gray-200 bg-white p-5"
      >
        <h2 id="leave-dialog-title" className="text-[15px] font-semibold text-gray-900">
          {onLogin ? '분석을 잃어버리지 마세요' : '작업을 잃어버릴 수 있어요'}
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">
          {onLogin
            ? '지금 메인 화면으로 이동하면 진행 중인 작업을 되돌릴 수 없어요. 로그인하면 분석 중인 내용을 저장하고, 내 작업에서 언제든 이어갈 수 있어요.'
            : '진행 중인 작업을 그만두고 메인 화면으로 이동할까요? 이 작업은 되돌릴 수 없어요.'}
        </p>
        {onLogin && (
          <button
            type="button"
            autoFocus
            onClick={onLogin}
            className="mt-4 h-10 w-full rounded-full bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            로그인하고 분석 계속하기
          </button>
        )}
        <div className={onLogin ? 'mt-1.5 flex justify-between gap-2' : 'mt-4 flex justify-end gap-2'}>
          <button
            type="button"
            onClick={onStay}
            className="h-9 rounded-full px-3.5 text-[13px] font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            계속 분석하기
          </button>
          <button
            type="button"
            autoFocus={!onLogin}
            onClick={onLeave}
            className={
              onLogin
                ? 'h-9 rounded-full px-3.5 text-[13px] font-medium text-gray-600 transition-colors hover:text-gray-900'
                : 'h-9 rounded-full bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover'
            }
          >
            그만두고 이동
          </button>
        </div>
      </div>
    </div>
  )
}
