import { useEffect } from 'react'
import { track } from '../lib/analytics'

const CLOSED_STORAGE = 'whoisloafing:deep-nudge-closed'
/** 이만큼 닫았으면 더 권하지 않아요. */
const CLOSE_LIMIT = 3

function closedCount(): number {
  try {
    return Number(localStorage.getItem(CLOSED_STORAGE)) || 0
  } catch {
    return 0
  }
}

/** 심층 분석 안내를 띄워도 되는지. 여러 번 닫은 사람에게는 더 띄우지 않아요. */
export function shouldNudgeDeep(): boolean {
  return closedCount() < CLOSE_LIMIT
}

function rememberClose() {
  try {
    localStorage.setItem(CLOSED_STORAGE, String(closedCount() + 1))
  } catch {
    // 저장하지 못해도 안내는 닫혀요.
  }
}

/** 앱에서 레포의 기본 분석이 끝나면 오른쪽 위에 떠서, 같은 레포를 심층 분석으로 볼 수 있다고 알려줘요. */
export function DeepNudge({ onDeep, onClose }: { onDeep: () => void; onClose: () => void }) {
  useEffect(() => {
    track('deep_nudge_view')
  }, [])

  return (
    <section
      aria-labelledby="deep-nudge-title"
      className="absolute inset-x-3 bottom-3 z-20 animate-rise rounded-2xl border border-gray-200 bg-white p-4 md:inset-x-auto md:top-16 md:right-4 md:bottom-auto md:w-80"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="deep-nudge-title" className="text-[14px] font-semibold text-gray-900">
          심층 분석을 사용할 수 있음
        </h2>
        <button
          type="button"
          aria-label="닫기"
          onClick={() => {
            track('deep_nudge_close')
            rememberClose()
            onClose()
          }}
          className="-mt-1 -mr-1 flex size-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="size-3.5" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
      <p className="mt-1 break-keep text-[13px] leading-relaxed text-gray-500">
        프로젝트 구조, CI/CD 파이프라인, 템플릿 모두를 분석할 수 있는 심층 분석을 사용해보세요.
      </p>
      <button
        type="button"
        onClick={() => {
          track('deep_nudge_click')
          onDeep()
        }}
        className="mt-3.5 h-9 w-full rounded-full bg-brand text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover"
      >
        심층 분석으로 이동
      </button>
    </section>
  )
}
