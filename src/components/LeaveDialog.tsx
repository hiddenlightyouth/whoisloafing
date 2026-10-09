import { useEffect } from 'react'

interface Props {
  onStay: () => void
  onLeave: () => void
}

/** 분석 중에 로고를 눌렀을 때, 분석을 그만두고 메인 화면으로 갈지 묻는 창이에요. */
export function LeaveDialog({ onStay, onLeave }: Props) {
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
          작업을 잃어버릴 수 있어요
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">진행 중인 작업을 그만두고 메인 화면으로 이동할까요? 이 작업은 되돌릴 수 없어요.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onStay}
            className="h-9 rounded-full px-3.5 text-[13px] font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            계속 분석하기
          </button>
          <button
            type="button"
            autoFocus
            onClick={onLeave}
            className="h-9 rounded-full bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            그만두고 이동
          </button>
        </div>
      </div>
    </div>
  )
}
