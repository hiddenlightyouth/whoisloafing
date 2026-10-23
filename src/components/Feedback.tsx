import { useEffect, useRef, useState } from 'react'
import { track } from '../lib/analytics'
import { closeBugReport, sendFeedback } from '../lib/feedback'
import { showToast } from '../lib/toast'
import { Modal } from './Dialog'
import { messages, pick, useMessages } from '../lib/i18n'
import { CloseButton } from './Icons'

const TEXT = messages({
  ko: {
    thanks: '의견 고마워요. 더 좋게 만드는 데 쓸게요.',
    sendFailed: '의견을 보내지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
    promptLabel: '분석이 어땠는지 알려주기',
    promptTitle: '분석은 어땠나요?',
    close: '닫기',
    promptBody: '한 번만 눌러 주시면 서비스를 고치는 데 큰 도움이 돼요.',
    rating: '평가',
    good: '좋았어요',
    bad: '아쉬웠어요',
    goodPlaceholder: '어떤 점이 좋았는지 알려주세요. 적지 않아도 돼요.',
    badPlaceholder: '어떤 점이 아쉬웠는지 알려주세요. 적지 않아도 돼요.',
    comment: '덧붙일 말',
    working: '처리 중',
    send: '보내기',
    // 버그 신고의 문구는 격식체로 써요.
    bugFailed: '신고를 보내지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
    bugDone: '버그 신고가 접수되었습니다. 불편을 겪지 않도록 빠른 시일 내로 해결하겠습니다.',
    bugTitle: '버그 신고',
    bugNotice: '이 보고서에는 귀하의 설명과 현재 세션 기록이 포함됩니다. 관련 문제를 디버그하고 Lofy를 개선하기 위해 이 정보를 사용할 수 있습니다.',
    bugPlaceholder: '문제를 설명해 주세요',
    bugLabel: '문제 설명',
    cancel: '취소',
  },
  en: {
    thanks: "Thanks for the feedback. We'll use it to make things better.",
    sendFailed: "Couldn't send your feedback. Please try again in a moment.",
    promptLabel: 'Tell us how the analysis went',
    promptTitle: 'How was the analysis?',
    close: 'Close',
    promptBody: 'One tap helps us a lot in improving the service.',
    rating: 'Rating',
    good: 'Helpful',
    bad: 'Not great',
    goodPlaceholder: 'What did you like? This is optional.',
    badPlaceholder: 'What could be better? This is optional.',
    comment: 'Comment',
    working: 'Sending',
    send: 'Send',
    bugFailed: "Couldn't send the report. Please try again in a moment.",
    bugDone: "Your bug report has been received. We'll fix it as soon as we can.",
    bugTitle: 'Report a bug',
    bugNotice: 'This report includes your description and the current session record. We may use this information to debug the issue and improve Lofy.',
    bugPlaceholder: 'Describe the problem',
    bugLabel: 'Problem description',
    cancel: 'Cancel',
  },
})

const field =
  'w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[16px] leading-relaxed text-gray-900 outline-none placeholder:text-gray-400 sm:text-[13.5px]'
const choice = 'h-9 flex-1 rounded-full border text-[13px] font-medium transition-colors'

/**
 * 분석이 어땠는지 아주 가끔 물어보는 카드예요. 좋았는지 아쉬웠는지 고르면 한마디를 덧붙일 수 있어요.
 * 고르기만 하고 닫아도 고른 평가는 보내요. 넓은 화면에서는 오른쪽 위에, 좁은 화면에서는 아래에 떠요.
 */
export function FeedbackPrompt({ chatId, onClose }: { chatId: string | null; onClose: () => void }) {
  const [rating, setRating] = useState<'GOOD' | 'BAD' | null>(null)
  const text = useMessages(TEXT)
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
    showToast(ok ? pick(TEXT).thanks : pick(TEXT).sendFailed)
    onClose()
  }

  return (
    <section
      aria-label={text.promptLabel}
      className="absolute inset-x-3 bottom-3 z-20 origin-bottom md:origin-top-right animate-pop rounded-2xl border border-gray-200 bg-white p-4 md:inset-x-auto md:top-16 md:right-4 md:bottom-auto md:w-80"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[14px] font-semibold text-gray-900">{text.promptTitle}</h2>
        <CloseButton label={text.close} disabled={sending} onClick={() => void send(false)} className="-mt-1 -mr-1" />
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-gray-500">{text.promptBody}</p>
      <div role="radiogroup" aria-label={text.rating} className="mt-3 flex gap-2">
        {(
          [
            ['GOOD', text.good],
            ['BAD', text.bad],
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
            placeholder={rating === 'GOOD' ? text.goodPlaceholder : text.badPlaceholder}
            aria-label={text.comment}
            className={field}
          />
          <button
            type="button"
            disabled={sending}
            onClick={() => void send(true)}
            className="mt-2 h-9 w-full rounded-full bg-brand text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:bg-gray-200 disabled:text-gray-400"
          >
            {sending ? text.working : text.send}
          </button>
        </div>
      )}
    </section>
  )
}

/** 버그를 신고하는 창이에요. 무엇이 문제였는지 적어서 보내요. 보고 있던 화면의 주소와 채팅 ID가 함께 가요. */
export function BugReport({ chatId }: { chatId: string | null }) {
  const text = useMessages(TEXT)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    track('bug_report_open')
    inputRef.current?.focus()
  }, [])

  const ready = comment.trim().length >= 5

  async function send() {
    if (!ready || sending) return
    setSending(true)
    const ok = await sendFeedback({ kind: 'BUG', comment, chatId })
    setSending(false)
    track('feedback_send', { kind: 'bug', success: ok })
    if (!ok) {
      showToast(pick(TEXT).bugFailed)
      return
    }
    showToast(pick(TEXT).bugDone)
    closeBugReport()
  }

  return (
    <Modal onClose={closeBugReport} labelledBy="bug-report-title" className="w-full max-w-md p-5">
      <h2 id="bug-report-title" className="text-[15px] font-semibold text-gray-900">
        {text.bugTitle}
      </h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">{text.bugNotice}</p>
      <textarea
        ref={inputRef}
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        rows={5}
        maxLength={2000}
        placeholder={text.bugPlaceholder}
        aria-label={text.bugLabel}
        className={`${field} mt-3.5`}
      />
      <div className="mt-3.5 flex justify-end gap-2">
        <button type="button" onClick={closeBugReport} className="h-9 rounded-full px-3.5 text-[13px] font-medium text-gray-600 transition-colors hover:text-gray-900">
          {text.cancel}
        </button>
        <button
          type="button"
          disabled={!ready || sending}
          onClick={() => void send()}
          className="h-9 rounded-full bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:bg-gray-200 disabled:text-gray-400"
        >
          {sending ? text.working : text.send}
        </button>
      </div>
    </Modal>
  )
}
