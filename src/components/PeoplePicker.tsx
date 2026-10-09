import { useState } from 'react'
import type { FollowupPerson } from '../../shared/types'

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
    const names = picked.map((person) => `${person.name}님`)
    const label = names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} 외 ${names.length - 3}명`
    onPick(
      picked.map((person) => person.id),
      `${label}을 살펴봐 주세요.`,
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
              `상위 ${topPeople.length}명만 분석해 주세요.`,
              'top',
            )
          }
          className={`${action} bg-brand text-white hover:bg-brand-hover`}
        >
          상위 {topPeople.length}명만 분석하기
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-expanded={picking}
          onClick={() => setPicking((open) => !open)}
          className={`${action} bg-white text-gray-700 hover:text-brand`}
        >
          직접 고르기
        </button>
      </div>

      {picking && !disabled && (
        <div className="mt-3 animate-rise rounded-xl bg-white p-3.5">
          <p className="text-[13px] text-gray-500">
            살펴볼 사람을 골라 주세요. 최대 {max}명까지 고를 수 있어요.
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
              {chosen.length === 0 ? '사람을 골라 주세요' : `고른 ${chosen.length}명 분석하기`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
