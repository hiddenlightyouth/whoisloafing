import { useState } from 'react'
import type { FollowupPerson } from '../../shared/types'
import { messages, useMessages } from '../lib/i18n'

const TEXT = messages({
  ko: {
    customRequest: (names: string[]) => {
      const named = names.map((name) => `${name}님`)
      const label = named.length <= 3 ? named.join(', ') : `${named.slice(0, 3).join(', ')} 외 ${named.length - 3}명`
      return `${label}을 살펴봐 주세요.`
    },
    topRequest: (count: number) => `상위 ${count}명만 분석해 주세요.`,
    top: (count: number) => `상위 ${count}명만 분석하기`,
    choose: '직접 고르기',
    hint: (max: number) => `살펴볼 사람을 골라 주세요. 최대 ${max}명까지 고를 수 있어요.`,
    empty: '사람을 골라 주세요',
    submit: (count: number) => `고른 ${count}명 분석하기`,
  },
  en: {
    customRequest: (names: string[]) => {
      const label = names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`
      return `Please look at ${label}.`
    },
    topRequest: (count: number) => `Please analyze the top ${count} only.`,
    top: (count: number) => `Analyze the top ${count}`,
    choose: 'Choose people',
    hint: (max: number) => `Pick who to look at. You can choose up to ${max}.`,
    empty: 'Pick someone',
    submit: (count: number) => `Analyze ${count} selected`,
  },
})

interface Props {
  people: FollowupPerson[]
  /** "상위 N명만 분석하기"의 N */
  top: number
  /** 한 번에 고를 수 있는 최대 인원 */
  max: number
  disabled: boolean
  onPick: (ids: string[], userText: string, mode: 'top' | 'custom') => void
}

const action =
  'inline-flex h-9 items-center rounded-lg px-3.5 text-[13px] font-semibold transition-colors disabled:bg-gray-200 disabled:text-gray-400'

/** 참여자가 많을 때, 맡은 기능과 코드 스타일을 살펴볼 사람을 고르는 말풍선 안쪽이에요. */
export function PeoplePicker({ people, top, max, disabled, onPick }: Props) {
  const [picking, setPicking] = useState(false)
  const [chosen, setChosen] = useState<string[]>([])
  const text = useMessages(TEXT)

  const topPeople = people.slice(0, top)
  const full = chosen.length >= max

  function toggle(id: string) {
    setChosen((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : current.length < max ? [...current, id] : current,
    )
  }

  function submitChosen() {
    // 순위 순서를 유지해서 보내요.
    const picked = people.filter((person) => chosen.includes(person.id))
    onPick(
      picked.map((person) => person.id),
      text.customRequest(picked.map((person) => person.name)),
      'custom',
    )
  }

  return (
    <div className="mt-3 mb-1.5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            onPick(
              topPeople.map((person) => person.id),
              text.topRequest(topPeople.length),
              'top',
            )
          }
          className={`${action} bg-brand text-white hover:bg-brand-hover`}
        >
          {text.top(topPeople.length)}
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-expanded={picking}
          onClick={() => setPicking((open) => !open)}
          className={`${action} bg-white text-gray-700 hover:text-brand`}
        >
          {text.choose}
        </button>
      </div>

      {picking && !disabled && (
        <div className="mt-3 animate-rise rounded-xl bg-white p-3.5">
          <p className="text-[13px] text-gray-500">
            {text.hint(max)}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {people.map((person, index) => {
              const selected = chosen.includes(person.id)
              return (
                <button
                  key={person.id}
                  type="button"
                  aria-pressed={selected}
                  disabled={!selected && full}
                  onClick={() => toggle(person.id)}
                  className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors disabled:text-gray-300 ${
                    selected ? 'bg-brand text-white' : 'bg-gray-100 text-gray-700 hover:text-brand'
                  }`}
                >
                  <span className={`mr-1 tabular-nums ${selected ? 'text-white/70' : 'text-gray-400'}`}>{index + 1}</span>
                  {person.name}
                </button>
              )
            })}
          </div>
          <div className="mt-3.5 flex justify-end">
            <button
              type="button"
              disabled={chosen.length === 0}
              onClick={submitChosen}
              className={`${action} bg-brand text-white hover:bg-brand-hover`}
            >
              {chosen.length === 0 ? text.empty : text.submit(chosen.length)}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
