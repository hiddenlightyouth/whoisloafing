import { useState } from 'react'
import { FOLLOWUP_LABELS, type FollowupPerson, type FollowupQuestion } from '../../shared/types'

interface Props {
  people: FollowupPerson[]
  disabled: boolean
  onAsk: (question: FollowupQuestion, userText: string, person?: string) => void
}

const chip =
  'rounded-lg bg-white px-3 py-2 text-left text-[13px] font-medium text-gray-700 transition-colors hover:text-brand disabled:text-gray-400'

const QUESTIONS = Object.keys(FOLLOWUP_LABELS) as FollowupQuestion[]

/** 분석이 끝난 뒤에 이어서 물어볼 질문을 고르는 버튼 묶음이에요. */
export function Followup({ people, disabled, onAsk }: Props) {
  const [picking, setPicking] = useState(false)

  return (
    <div className="mt-3 mb-1.5">
      <div className="flex flex-col items-start gap-1.5">
        {QUESTIONS.map((question) => (
          <button
            key={question}
            type="button"
            disabled={disabled}
            aria-expanded={question === 'person' ? picking : undefined}
            onClick={() => (question === 'person' ? setPicking((open) => !open) : onAsk(question, FOLLOWUP_LABELS[question]))}
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
