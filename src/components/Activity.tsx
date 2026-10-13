import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DeepActivity } from '../../shared/types'
import { track } from '../lib/analytics'
import { MapMenu } from './DeepParts'

const DAY_MS = 24 * 60 * 60 * 1000
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']
/** 참여자별 흐름에 보여주는 사람 수 */
const MAX_ROWS = 10

/** 칸 하나의 크기와 칸 사이의 틈. 막대, 달력, 참여자 줄이 같은 값을 써서 세로로 줄이 맞아요. */
const CELL = 16
const GAP = 3
/** 왼쪽에 요일과 이름을 적는 자리의 너비 */
const GUTTER = 136

const card = 'max-w-full min-w-0 rounded-xl border border-gray-200 bg-white p-5'
const title = 'text-[13px] font-medium text-gray-500'
const axis = 'text-[11px] text-gray-400 tabular-nums'
const square = { width: CELL, height: CELL }

/** 왼쪽 이름 자리와 주마다 한 칸씩 늘어선 줄이에요. 옆으로 넘겨도 이름 자리는 제자리에 있어요. */
function Row({ label, children, className = '' }: { label?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`flex ${className}`}>
      <div className="sticky left-0 z-[1] flex shrink-0 self-stretch bg-white pr-3" style={{ width: GUTTER }}>
        {label}
      </div>
      <div className="flex" style={{ gap: GAP }}>
        {children}
      </div>
    </div>
  )
}

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

const shortDate = (at: number) => `${new Date(at).getMonth() + 1}/${new Date(at).getDate()}`
const longDate = (at: number) => {
  const date = new Date(at)
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`
}

/** 값이 클수록 메인 컬러가 진해져요. 0이면 옅은 회색이에요. 색은 토큰으로 섞어서 다크 모드에서도 같이 바뀌어요. */
function tone(value: number, max: number): string {
  if (value <= 0 || max <= 0) return 'var(--color-gray-100)'
  const level = Math.min(4, Math.ceil((value / max) * 4))
  return `color-mix(in srgb, var(--color-brand) ${[0, 28, 52, 76, 100][level]}%, var(--color-gray-100))`
}

/**
 * 심층 분석의 활동 탭이에요. 커밋이 언제 얼마나 있었는지를 그려요.
 * 주 단위 막대, 날마다의 달력, 참여자별 흐름은 같은 가로축(한 칸이 한 주)을 나눠 써서 한 장으로 이어 붙이고, 요일과 시간은 옆에 따로 둬요.
 * 서버는 커밋마다 시각과 작성자만 보내고, 날짜와 시간으로 묶는 일은 기기의 시간대에 맞춰 여기서 해요.
 */
export function Activity({ activity, repo }: { activity: DeepActivity; repo: string }) {
  /** 고른 참여자의 번호. null이면 모두예요. */
  const [person, setPerson] = useState<number | null>(null)
  const commits = useMemo(() => (person === null ? activity.commits : activity.commits.filter((commit) => commit.person === person)), [activity, person])

  // 그래프의 가로 범위는 사람을 골라도 바뀌지 않게, 전체 커밋의 처음과 끝으로 잡아요.
  const range = useMemo(() => {
    if (activity.commits.length === 0) return null
    const first = weekStart(activity.commits[0].at)
    const last = weekStart(activity.commits[activity.commits.length - 1].at)
    const weeks: number[] = []
    for (let at = first; at <= last; at = addDays(at, 7)) weeks.push(at)
    return { weeks, index: new Map(weeks.map((at, order) => [at, order])) }
  }, [activity])

  const stats = useMemo(() => {
    const days = new Map<number, number>()
    const weeks = new Map<number, number>()
    const hours = Array.from({ length: 7 }, () => Array<number>(24).fill(0))
    for (const commit of commits) {
      const date = new Date(commit.at)
      const day = dayStart(commit.at)
      const week = weekStart(commit.at)
      days.set(day, (days.get(day) ?? 0) + 1)
      weeks.set(week, (weeks.get(week) ?? 0) + 1)
      hours[date.getDay()][date.getHours()] += 1
    }
    const busiest = [...weeks].sort((a, b) => b[1] - a[1])[0]
    return {
      days,
      weeks,
      hours,
      dayMax: Math.max(0, ...days.values()),
      weekMax: Math.max(0, ...weeks.values()),
      hourMax: Math.max(0, ...hours.flat()),
      busiest,
    }
  }, [commits])

  /** 참여자마다 주 단위로 센 커밋 수 */
  const rows = useMemo(() => {
    if (!range) return []
    const counts = activity.people.slice(0, MAX_ROWS).map(() => Array<number>(range.weeks.length).fill(0))
    for (const commit of activity.commits) {
      const row = counts[commit.person]
      const column = range.index.get(weekStart(commit.at))
      if (row && column !== undefined) row[column] += 1
    }
    return counts
  }, [activity, range])

  // 긴 기간은 옆으로 넘겨 봐요. 처음에는 가장 최근 쪽이 보이게 오른쪽 끝에 둬요.
  const timelineRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = timelineRef.current
    if (element) element.scrollLeft = element.scrollWidth
  }, [range])

  if (!range || commits.length === 0 && person === null) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center bg-gray-50 px-6">
        <p className="animate-rise text-center text-[14px] leading-relaxed text-gray-600">아직 살펴볼 커밋이 없어요.</p>
      </div>
    )
  }

  const first = commits[0]?.at
  const last = commits[commits.length - 1]?.at
  const span = first !== undefined && last !== undefined ? Math.round((dayStart(last) - dayStart(first)) / DAY_MS) + 1 : 0
  const facts: [string, string][] =
    first === undefined || last === undefined
      ? []
      : [
          ['첫 커밋', longDate(first)],
          ['마지막 커밋', longDate(last)],
          ['전체 기간', `${span.toLocaleString('ko-KR')}일`],
          ['커밋이 있었던 날', `${stats.days.size.toLocaleString('ko-KR')}일`],
          ['가장 바빴던 주', stats.busiest ? `${shortDate(stats.busiest[0])} 주, ${stats.busiest[1].toLocaleString('ko-KR')}개` : ''],
          ['하루 평균 커밋', `${(commits.length / Math.max(1, stats.days.size)).toFixed(1)}개`],
        ]
  const picked = person === null ? null : activity.people[person]
  const { weeks } = range
  const count = (value: number) => `${value.toLocaleString('ko-KR')}개`

  function pick(order: number | null) {
    track('deep_activity_person', { repo, picked: order !== null })
    setPerson(order)
  }

  return (
    <div className="relative min-h-0 min-w-0 flex-1 bg-gray-50">
      <div className="h-full animate-rise overflow-auto px-4 pt-16 pb-4">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-200 lg:grid-cols-3 2xl:grid-cols-6">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0 bg-white px-5 py-4">
              <dt className="text-[12.5px] text-gray-500">{label}</dt>
              <dd className="mt-1 truncate text-[16px] font-semibold text-gray-900 tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 flex flex-wrap items-start gap-4">
          <section className={card}>
            <h3 className={title}>기간별 커밋</h3>
            <div ref={timelineRef} className="mt-4 overflow-x-auto pb-1">
              <div className="flex w-max flex-col pr-3" style={{ gap: GAP }}>
                <Row className={`h-4 ${axis}`}>
                  {weeks.map((week, order) => {
                    // 달이 바뀌는 주에만 달 이름을 적어요. 맨 앞의 달이 한두 주뿐이면 다음 달 이름과 겹쳐서 적지 않아요.
                    const month = new Date(week).getMonth()
                    const changed = order === 0 ? weeks.slice(1, 3).every((next) => new Date(next).getMonth() === month) : new Date(weeks[order - 1]).getMonth() !== month
                    return (
                      <span key={week} className="shrink-0 overflow-visible whitespace-nowrap" style={{ width: CELL }}>
                        {changed ? `${month + 1}월` : ''}
                      </span>
                    )
                  })}
                </Row>

                <Row className="mb-1 h-20 items-end" label={<span className={`ml-auto self-start ${axis}`}>{count(stats.weekMax)}</span>}>
                  {weeks.map((week) => {
                    const value = stats.weeks.get(week) ?? 0
                    return (
                      <div key={week} className="flex h-20 shrink-0 flex-col justify-end" style={{ width: CELL }} title={`${shortDate(week)} 주, 커밋 ${count(value)}`}>
                        <div
                          className="origin-bottom animate-grow-up rounded-t-[3px] bg-brand"
                          style={{ height: `${stats.weekMax > 0 ? (value / stats.weekMax) * 100 : 0}%`, minHeight: value > 0 ? 3 : 0 }}
                        />
                      </div>
                    )
                  })}
                </Row>

                {DAY_NAMES.map((name, day) => (
                  <Row key={name} label={<span className={`ml-auto leading-4 ${axis} ${day % 2 === 1 ? '' : 'invisible'}`}>{name}</span>}>
                    {weeks.map((week) => {
                      const at = addDays(week, day)
                      const value = stats.days.get(at) ?? 0
                      return <span key={week} title={`${longDate(at)}, 커밋 ${count(value)}`} className="shrink-0 rounded-[4px]" style={{ ...square, background: tone(value, stats.dayMax) }} />
                    })}
                  </Row>
                ))}

                <div aria-hidden className="h-2" />

                {rows.map((row, order) => {
                  const max = Math.max(0, ...row)
                  const who = activity.people[order]
                  const active = person === order
                  return (
                    <Row
                      key={who.id}
                      className={`transition-opacity ${person !== null && !active ? 'opacity-40' : ''}`}
                      label={
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => pick(active ? null : order)}
                          className={`flex min-w-0 flex-1 items-center gap-2 text-left text-[12.5px] leading-4 transition-colors hover:text-brand ${active ? 'text-brand-hover' : 'text-gray-800'}`}
                        >
                          <span className="min-w-0 flex-1 truncate font-medium">{who.name}</span>
                          <span className={`shrink-0 ${axis}`}>{who.commits.toLocaleString('ko-KR')}</span>
                        </button>
                      }
                    >
                      {row.map((value, column) => (
                        <span key={column} title={`${who.name}, ${shortDate(weeks[column])} 주, 커밋 ${count(value)}`} className="shrink-0 rounded-[4px]" style={{ ...square, background: tone(value, max) }} />
                      ))}
                    </Row>
                  )
                })}
              </div>
            </div>
          </section>

          <section className={card}>
            <h3 className={title}>요일과 시간</h3>
            <div className="mt-4 overflow-x-auto pb-1">
              <div className="flex w-max flex-col" style={{ gap: GAP }}>
                {stats.hours.map((row, day) => (
                  <div key={day} className="flex" style={{ gap: GAP }}>
                    <span className={`w-5 shrink-0 leading-4 ${axis}`}>{DAY_NAMES[day]}</span>
                    {row.map((value, hour) => (
                      <span key={hour} title={`${DAY_NAMES[day]}요일 ${hour}시, 커밋 ${count(value)}`} className="shrink-0 rounded-[4px]" style={{ ...square, background: tone(value, stats.hourMax) }} />
                    ))}
                  </div>
                ))}
                <div className={`mt-1 flex ${axis}`} style={{ gap: GAP }}>
                  <span className="w-5 shrink-0" />
                  {Array.from({ length: 24 }, (_, hour) => (
                    <span key={hour} className="shrink-0 overflow-visible whitespace-nowrap" style={{ width: CELL }}>
                      {hour % 6 === 0 ? `${hour}시` : ''}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        {activity.capped && <p className="mt-4 px-1 text-[12.5px] text-gray-500">커밋이 많아서 최근 {activity.commits.length.toLocaleString('ko-KR')}개를 기준으로 그렸어요.</p>}
      </div>

      {/* 스크롤한 내용이 메뉴 뒤로 비치지 않게, 메뉴가 있는 줄에 바탕을 깔아요. */}
      <div className="absolute inset-x-0 top-0 flex h-16 items-center justify-between gap-2 bg-gray-50 px-4">
        <MapMenu
          label="참여자"
          value={picked ? picked.name : '전체'}
          active={picked !== null}
          groups={[
            {
              items: [
                { label: '전체', hint: `${activity.commits.length.toLocaleString('ko-KR')}개의 커밋`, checked: person === null, onSelect: () => setPerson(null) },
                ...activity.people.map((who, order) => ({
                  label: who.name,
                  hint: `${who.commits.toLocaleString('ko-KR')}개의 커밋`,
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
            <span key={level} aria-hidden className="size-3 rounded-[3px]" style={{ background: tone(level, 4) }} />
          ))}
          <span>많음</span>
        </div>
      </div>
    </div>
  )
}
