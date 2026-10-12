import { useState } from 'react'
import { track } from '../lib/analytics'
import { ANALYSIS_LABEL, FOLLOWUP_LABELS, type FollowupPerson, type FollowupQuestion } from '../../shared/types'

interface Props {
  people: FollowupPerson[]
  disabled: boolean
  onAsk: (question: FollowupQuestion, userText: string, person?: string) => void
  /** 아직 기여도 분석 전이면 있어요. 맨 위에 기여도 분석을 시작하는 버튼을 보여줘요. */
  onStart?: () => void
}

const chip =
  'rounded-lg bg-white px-3 py-2 text-left text-[13px] font-medium text-gray-700 transition-colors hover:text-brand disabled:text-gray-400'

const QUESTIONS = Object.keys(FOLLOWUP_LABELS) as FollowupQuestion[]

/** 살펴볼 내용을 고르는 버튼 묶음이에요. 레포 소개 직후와 답이 끝날 때마다 나와요. */
export function Followup({ people, disabled, onAsk, onStart }: Props) {
  const [picking, setPicking] = useState(false)

  return (
    <div className="mt-3 mb-1.5">
      <div className="flex flex-col items-start gap-1.5">
        {onStart && (
          <button
            type="button"
            disabled={disabled}
            onClick={onStart}
            className={chip}
          >
            {ANALYSIS_LABEL}
          </button>
        )}
        {QUESTIONS.filter((question) => question !== 'person' || people.length > 0).map((question) => (
          <button
            key={question}
            type="button"
            disabled={disabled}
            aria-expanded={question === 'person' ? picking : undefined}
            onClick={() => (question === 'person'
                ? (track('followup_person_picker_toggle'), setPicking((open) => !open))
                : onAsk(question, FOLLOWUP_LABELS[question]))}
            className={`${chip} ${question === 'person' && picking && !disabled ? 'text-brand' : ''}`}
          >
            {FOLLOWUP_LABELS[question]}
          </button>
        ))}
      </div>

      {picking && !disabled && (
        <div className="mt-2.5 animate-rise">
          <p className="text-[13px] text-gray-500">누구를 살펴볼까요?</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {people.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => onAsk('person', `${person.name}님을 자세히 보고 싶어요.`, person.id)}
                className="rounded-full bg-brand-soft px-3 py-1.5 text-[13px] font-medium text-brand transition-colors hover:bg-brand hover:text-white"
              >
                {person.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
