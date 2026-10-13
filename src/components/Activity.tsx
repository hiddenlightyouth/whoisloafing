import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { DeepActivity } from '../../shared/types'
import { track } from '../lib/analytics'
import { MapMenu } from './DeepParts'

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']
/** 칸 사이의 틈과, 화면에 맞춰 커지고 작아지는 칸 크기의 범위 */
const GAP = 4
const MIN_CELL = 12
const MAX_CELL = 44
/** 왼쪽에 요일을 적는 자리와 위에 달을 적는 자리 */
const GUTTER = 28
const HEADER = 24
/** 칸이 이보다 크면 칸 안에 날짜를 적어요. */
const DATE_CELL = 30

const axis = 'text-[11px] text-gray-400 tabular-nums'

/** 기기의 시간대로 그날 0시를 구해요. */
function dayStart(at: number): number {
  const date = new Date(at)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** 그 주의 일요일 0시를 구해요. 서머타임으로 하루 길이가 달라도 어긋나지 않게 날짜로 계산해요. */
function weekStart(at: number): number {
  const date = new Date(at)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay()).getTime()
}

const addDays = (at: number, days: number) => {
  const date = new Date(at)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days).getTime()
}

const longDate = (at: number) => {
  const date = new Date(at)
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`
}

/** 커밋이 많을수록 높은 단계예요. 0이면 커밋이 없는 날이에요. */
const levelOf = (value: number, max: number) => (value <= 0 || max <= 0 ? 0 : Math.min(4, Math.ceil((value / max) * 4)))
/** 단계가 높을수록 메인 컬러가 진해져요. 색은 토큰으로 섞어서 다크 모드에서도 같이 바뀌어요. */
const tone = (level: number) => (level === 0 ? 'var(--color-gray-200)' : `color-mix(in srgb, var(--color-brand) ${[0, 28, 52, 76, 100][level]}%, var(--color-gray-200))`)

/**
 * 심층 분석의 활동 탭이에요. GitHub 기여도 그래프처럼 칸 하나가 하루인 달력 하나를 바탕 가득 띄워요.
 * 서버는 커밋마다 시각과 작성자만 보내고, 날짜로 묶는 일은 기기의 시간대에 맞춰 여기서 해요.
 */
export function Activity({ activity, repo }: { activity: DeepActivity; repo: string }) {
  /** 고른 참여자의 번호. null이면 모두예요. */
  const [person, setPerson] = useState<number | null>(null)
  /** 마우스를 올린 날 */
  const [focus, setFocus] = useState<number | null>(null)
  const commits = useMemo(() => (person === null ? activity.commits : activity.commits.filter((commit) => commit.person === person)), [activity, person])

  // 달력의 가로 범위는 사람을 골라도 바뀌지 않게, 전체 커밋의 처음과 끝으로 잡아요.
  const weeks = useMemo(() => {
    if (activity.commits.length === 0) return []
    const last = weekStart(activity.commits[activity.commits.length - 1].at)
    const list: number[] = []
    for (let at = weekStart(activity.commits[0].at); at <= last; at = addDays(at, 7)) list.push(at)
    return list
  }, [activity])

  const days = useMemo(() => {
    const counts = new Map<number, number>()
    for (const commit of commits) {
      const day = dayStart(commit.at)
      counts.set(day, (counts.get(day) ?? 0) + 1)
    }
    return { counts, max: Math.max(0, ...counts.values()) }
  }, [commits])

  // 달력이 바탕에 꽉 차게, 바탕의 크기에 맞춰 칸 크기를 정해요.
  const canvasRef = useRef<HTMLDivElement>(null)
  const [cell, setCell] = useState(MIN_CELL)
  useLayoutEffect(() => {
    const element = canvasRef.current
    if (!element || weeks.length === 0) return
    const measure = () => {
      const wide = (element.clientWidth - GUTTER) / weeks.length - GAP
      const tall = (element.clientHeight - HEADER) / 7 - GAP
      setCell(Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor(Math.min(wide, tall)))))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [weeks])

  // 긴 기간은 옆으로 넘겨 봐요. 처음에는 가장 최근 쪽이 보이게 오른쪽 끝에 둬요.
  useEffect(() => {
    const element = canvasRef.current
    if (element) element.scrollLeft = element.scrollWidth
  }, [weeks, cell])

  if (weeks.length === 0) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center bg-gray-50 px-6">
        <p className="animate-rise text-center text-[14px] leading-relaxed text-gray-600">아직 살펴볼 커밋이 없어요.</p>
      </div>
    )
  }

  const picked = person === null ? null : activity.people[person]
  const count = (value: number) => `${value.toLocaleString('ko-KR')}개의 커밋`
  const first = commits[0]?.at
  const last = commits[commits.length - 1]?.at
  const dated = cell >= DATE_CELL
  const square = { width: cell, height: cell }
  /** 마우스를 올린 날에 커밋한 사람들. 많이 한 사람부터예요. */
  const authors =
    focus === null
      ? []
      : [...commits.filter((commit) => dayStart(commit.at) === focus).reduce((map, commit) => map.set(commit.person, (map.get(commit.person) ?? 0) + 1), new Map<number, number>())].sort(
          (a, b) => b[1] - a[1],
        )

  function pick(order: number | null) {
    track('deep_activity_person', { repo, picked: order !== null })
    setPerson(order)
  }

  return (
    <div className="relative min-h-0 min-w-0 flex-1 bg-gray-50">
      <div ref={canvasRef} className="absolute inset-x-4 top-16 bottom-24 flex overflow-x-auto">
        <div className="m-auto flex animate-rise" style={{ gap: GAP }} onPointerLeave={() => setFocus(null)}>
          <div className={`sticky left-0 z-[1] flex shrink-0 flex-col bg-gray-50 ${axis}`} style={{ width: GUTTER - GAP, gap: GAP, paddingTop: HEADER }}>
            {DAY_NAMES.map((name, day) => (
              <span key={name} className={`flex items-center ${dated || day % 2 === 1 ? '' : 'invisible'}`} style={{ height: cell }}>
                {name}
              </span>
            ))}
          </div>
          {weeks.map((week, order) => {
            // 달이 바뀌는 주에만 달 이름을 적어요. 맨 앞의 달이 한두 주뿐이고 칸이 작으면 다음 달 이름과 겹쳐서 적지 않아요.
            const month = new Date(week).getMonth()
            const changed =
              order === 0 ? dated || weeks.slice(1, 3).every((next) => new Date(next).getMonth() === month) : new Date(weeks[order - 1]).getMonth() !== month
            return (
              <div key={week} className="flex shrink-0 flex-col" style={{ gap: GAP, width: cell }}>
                <span className={`overflow-visible whitespace-nowrap ${axis}`} style={{ height: HEADER - GAP }}>
                  {changed ? `${month + 1}월` : ''}
                </span>
                {DAY_NAMES.map((_, day) => {
                  const at = addDays(week, day)
                  const level = levelOf(days.counts.get(at) ?? 0, days.max)
                  return (
                    <span
                      key={day}
                      onPointerEnter={() => setFocus(at)}
                      className={`flex items-center justify-center text-[11px] tabular-nums ${cell >= 20 ? 'rounded-md' : 'rounded-[3px]'} ${
                        level >= 3 ? 'text-[#fff]' : 'text-gray-500'
                      } ${focus === at ? 'outline-2 outline-offset-1 outline-gray-900' : ''}`}
                      style={{ ...square, background: tone(level) }}
                    >
                      {dated && new Date(at).getDate()}
                    </span>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      <div className="absolute bottom-4 left-4 w-72 rounded-xl border border-gray-200 bg-white p-4">
        {focus === null || first === undefined || last === undefined ? (
          <>
            <p className="text-[13px] font-semibold text-gray-900 tabular-nums">{first === undefined || last === undefined ? '커밋이 없어요' : `${longDate(first)}부터 ${longDate(last)}까지`}</p>
            <p className="mt-1 text-[12.5px] text-gray-500 tabular-nums">
              {count(commits.length)}, 커밋한 날 {days.counts.size.toLocaleString('ko-KR')}일
              {activity.capped && ', 최근 커밋만 봤어요'}
            </p>
          </>
        ) : (
          <>
            <p className="text-[13px] font-semibold text-gray-900 tabular-nums">
              {longDate(focus)} {DAY_NAMES[new Date(focus).getDay()]}요일
            </p>
            <p className="mt-1 text-[12.5px] text-gray-500 tabular-nums">{authors.length === 0 ? '커밋이 없어요' : count(days.counts.get(focus) ?? 0)}</p>
            {person === null && authors.length > 0 && (
              <ul className="mt-2 space-y-1">
                {authors.slice(0, 5).map(([who, value]) => (
                  <li key={who} className="flex gap-2 text-[12.5px] text-gray-700">
                    <span className="min-w-0 flex-1 truncate">{activity.people[who]?.name}</span>
                    <span className="shrink-0 text-gray-500 tabular-nums">{value.toLocaleString('ko-KR')}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="absolute inset-x-0 top-0 flex h-16 items-center justify-between gap-2 px-4">
        <MapMenu
          label="참여자"
          value={picked ? picked.name : '전체'}
          active={picked !== null}
          groups={[
            {
              items: [
                { label: '전체', hint: count(activity.commits.length), checked: person === null, onSelect: () => setPerson(null) },
                ...activity.people.map((who, order) => ({
                  label: who.name,
                  hint: count(who.commits),
                  checked: person === order,
                  onSelect: () => pick(order),
                })),
              ],
            },
          ]}
        />
        <div className={`flex items-center gap-1.5 ${axis}`}>
          <span>적음</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <span key={level} aria-hidden className="size-3 rounded-[3px]" style={{ background: tone(level) }} />
          ))}
          <span>많음</span>
        </div>
      </div>
    </div>
  )
}
