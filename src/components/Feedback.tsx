import { useEffect, useRef, useState } from 'react'
import { track } from '../lib/analytics'
import { closeBugReport, sendFeedback } from '../lib/feedback'
import { showToast } from '../lib/toast'

const field =
  'w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[16px] leading-relaxed text-gray-900 outline-none placeholder:text-gray-400 sm:text-[13.5px]'
const choice = 'h-9 flex-1 rounded-full border text-[13px] font-medium transition-colors'

/**
 * 분석이 어땠는지 아주 가끔 물어보는 카드예요. 좋았는지 아쉬웠는지 고르면 한마디를 덧붙일 수 있어요.
 * 고르기만 하고 닫아도 고른 평가는 보내요. 넓은 화면에서는 오른쪽 위에, 좁은 화면에서는 아래에 떠요.
 */
export function FeedbackPrompt({ chatId, onClose }: { chatId: string | null; onClose: () => void }) {
  const [rating, setRating] = useState<'GOOD' | 'BAD' | null>(null)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    track('feedback_prompt_view')
  }, [])

  async function send(withComment: boolean) {
    if (!rating) {
      track('feedback_prompt_close')
      onClose()
      return
    }
    setSending(true)
    const ok = await sendFeedback({ kind: 'RATING', rating, comment: withComment ? comment : undefined, chatId })
    track('feedback_send', { kind: 'rating', rating, commented: withComment && comment.trim().length > 0, success: ok })
    showToast(ok ? '의견 고마워요. 더 좋게 만드는 데 쓸게요.' : '의견을 보내지 못했어요. 잠시 뒤에 다시 시도해 주세요.')
    onClose()
  }

  return (
    <section
      aria-label="분석이 어땠는지 알려주기"
      className="absolute inset-x-3 bottom-3 z-20 animate-rise rounded-2xl border border-gray-200 bg-white p-4 md:inset-x-auto md:top-16 md:right-4 md:bottom-auto md:w-80"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[14px] font-semibold text-gray-900">분석은 어땠나요?</h2>
        <button type="button" aria-label="닫기" disabled={sending} onClick={() => void send(false)} className="-mt-1 -mr-1 flex size-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="size-3.5" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-gray-500">한 번만 눌러 주시면 서비스를 고치는 데 큰 도움이 돼요.</p>
      <div role="radiogroup" aria-label="평가" className="mt-3 flex gap-2">
        {(
          [
            ['GOOD', '좋았어요'],
            ['BAD', '아쉬웠어요'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            onClick={() => setRating(value)}
            className={`${choice} ${rating === value ? 'border-brand bg-brand-soft text-brand-hover' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {rating && (
        <div className="mt-3 animate-rise">
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={rating === 'GOOD' ? '어떤 점이 좋았는지 알려주세요. 적지 않아도 돼요.' : '어떤 점이 아쉬웠는지 알려주세요. 적지 않아도 돼요.'}
            aria-label="덧붙일 말"
            className={field}
          />
          <button
            type="button"
            disabled={sending}
            onClick={() => void send(true)}
            className="mt-2 h-9 w-full rounded-full bg-brand text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:bg-gray-200 disabled:text-gray-400"
          >
            {sending ? '처리 중' : '보내기'}
          </button>
        </div>
      )}
    </section>
  )
}

/** 버그를 신고하는 창이에요. 무엇이 문제였는지 적어서 보내요. 보고 있던 화면의 주소와 채팅 ID가 함께 가요. */
export function BugReport({ chatId }: { chatId: string | null }) {
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    track('bug_report_open')
    inputRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeBugReport()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const ready = comment.trim().length >= 5

  async function send() {
    if (!ready || sending) return
    setSending(true)
    const ok = await sendFeedback({ kind: 'BUG', comment, chatId })
    setSending(false)
    track('feedback_send', { kind: 'bug', success: ok })
    if (!ok) {
      showToast('신고를 보내지 못했어요. 잠시 뒤에 다시 시도해 주세요.')
      return
    }
    showToast('신고 고마워요. 확인해 볼게요.')
    closeBugReport()
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/25 px-5 backdrop-blur-[2px]"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) closeBugReport()
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="bug-report-title" className="w-full max-w-md animate-rise rounded-2xl border border-gray-200 bg-white p-5">
        <h2 id="bug-report-title" className="text-[15px] font-semibold text-gray-900">
          버그 신고
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">이 보고서에는 귀하의 설명과 현재 세션 기록이 포함됩니다. 관련 문제를 디버그하고 WhoIsLoafing을 개선하기 위해 이 정보를 사용할 수 있습니다.</p>
        <textarea
          ref={inputRef}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={5}
          maxLength={2000}
          placeholder="문제를 설명해 주세요"
          aria-label="문제 설명"
          className={`${field} mt-3.5`}
        />
        <div className="mt-3.5 flex justify-end gap-2">
          <button type="button" onClick={closeBugReport} className="h-9 rounded-full px-3.5 text-[13px] font-medium text-gray-600 transition-colors hover:text-gray-900">
            취소
          </button>
          <button
            type="button"
            disabled={!ready || sending}
            onClick={() => void send()}
            className="h-9 rounded-full bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:bg-gray-200 disabled:text-gray-400"
          >
            {sending ? '처리 중' : '보내기'}
          </button>
        </div>
      </div>
    </div>
  )
}
