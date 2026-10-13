import { useToast } from '../lib/toast'

/** 링크 복사, 공유, 삭제 같은 결과를 화면 아래 가운데에 잠깐 보여줘요. */
export function Toast() {
  const toast = useToast()

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-50 flex justify-center px-4"
    >
      {toast && (
        <p
          key={toast.id}
          className="max-w-sm origin-bottom animate-pop rounded-full bg-gray-900/90 px-4 py-2.5 text-center text-[13px] leading-snug text-white backdrop-blur-md"
        >
          {toast.text}
        </p>
      )}
    </div>
  )
}
