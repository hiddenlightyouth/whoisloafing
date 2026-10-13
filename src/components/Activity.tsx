import { useEffect, useMemo, useRef, useState } from 'react'
import type { DeepActivity } from '../../shared/types'
import { track } from '../lib/analytics'
import { MapMenu } from './DeepParts'

const DAY_MS = 24 * 60 * 60 * 1000
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']
/** 참여자별 흐름에 보여주는 사람 수 */
const MAX_ROWS = 10

const card = 'rounded-xl border border-gray-200 bg-white p-5'
const heading = 'text-[14.5px] font-semibold text-gray-900'
const caption = 'mt-1 text-[12.5px] text-gray-500'

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
 * 심층 분석의 활동 탭이에요. 커밋이 언제 얼마나 있었는지를 달력, 주 단위 막대, 요일과 시간, 참여자별 흐름으로 그려요.
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
  const calendarRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = calendarRef.current
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
  /** 주가 많으면 날짜를 드문드문 적어요. */
  const labelEvery = Math.max(1, Math.ceil(weeks.length / 12))

  return (
    <div className="relative min-h-0 min-w-0 flex-1 bg-gray-50">
      <div className="h-full animate-rise space-y-4 overflow-auto px-4 pt-16 pb-4">
        <section className={card}>
          <h3 className={heading}>한눈에 보기</h3>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-3 2xl:grid-cols-6">
            {facts.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[12.5px] text-gray-500">{label}</dt>
                <dd className="mt-1 truncate text-[17px] font-semibold text-gray-900 tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={card}>
          <h3 className={heading}>날마다의 커밋</h3>
          <p className={caption}>칸 하나가 하루예요. 커밋이 많은 날일수록 진해요.</p>
          <div ref={calendarRef} className="mt-4 overflow-x-auto pb-1">
            <div className="inline-flex gap-2">
              <div className="grid shrink-0 grid-rows-7 gap-[3px] pt-5 text-[11px] leading-[13px] text-gray-400">
                {DAY_NAMES.map((name, day) => (
                  <span key={name} className={day % 2 === 1 ? '' : 'invisible'}>
                    {name}
                  </span>
                ))}
              </div>
              <div>
                <div className="flex h-5 gap-[3px] text-[11px] text-gray-400">
                  {weeks.map((week, order) => {
                    // 달이 바뀌는 주에만 달 이름을 적어요.
                    const month = new Date(week).getMonth()
                    const changed = order === 0 || new Date(weeks[order - 1]).getMonth() !== month
                    return (
                      <span key={week} className="w-[13px] shrink-0 overflow-visible whitespace-nowrap">
                        {changed ? `${month + 1}월` : ''}
                      </span>
                    )
                  })}
                </div>
                <div className="flex gap-[3px]">
                  {weeks.map((week) => (
                    <div key={week} className="grid shrink-0 grid-rows-7 gap-[3px]">
                      {DAY_NAMES.map((_, day) => {
                        const at = addDays(week, day)
                        const count = stats.days.get(at) ?? 0
                        return (
                          <span
                            key={day}
                            title={`${longDate(at)}, 커밋 ${count.toLocaleString('ko-KR')}개`}
                            className="size-[13px] rounded-[3px]"
                            style={{ background: tone(count, stats.dayMax) }}
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={card}>
          <h3 className={heading}>주 단위 커밋 수</h3>
          <p className={caption}>일요일부터 토요일까지를 한 주로 묶었어요.</p>
          <div className="mt-4 overflow-x-auto pb-1">
            <div className="flex h-44 items-end gap-1" style={{ minWidth: weeks.length * 10 }}>
              {weeks.map((week) => {
                const count = stats.weeks.get(week) ?? 0
                return (
                  <div key={week} className="flex h-full min-w-[6px] flex-1 flex-col justify-end" title={`${shortDate(week)} 주, 커밋 ${count.toLocaleString('ko-KR')}개`}>
                    <div
                      className="origin-bottom animate-grow-up rounded-t-[3px] bg-brand"
                      style={{ height: `${stats.weekMax > 0 ? (count / stats.weekMax) * 100 : 0}%`, minHeight: count > 0 ? 3 : 0 }}
                    />
                  </div>
                )
              })}
            </div>
            <div className="mt-2 flex gap-1 text-[11px] text-gray-400 tabular-nums" style={{ minWidth: weeks.length * 10 }}>
              {weeks.map((week, order) => (
                <span key={week} className="min-w-[6px] flex-1 overflow-visible whitespace-nowrap">
                  {order % labelEvery === 0 ? shortDate(week) : ''}
                </span>
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className={card}>
            <h3 className={heading}>요일과 시간</h3>
            <p className={caption}>어느 요일 몇 시에 커밋이 몰렸는지예요. 이 기기의 시간대 기준이에요.</p>
            <div className="mt-4 overflow-x-auto">
              <div className="min-w-[420px]">
                {stats.hours.map((row, day) => (
                  <div key={day} className="mb-[3px] flex items-center gap-2">
                    <span className="w-4 shrink-0 text-[11px] text-gray-400">{DAY_NAMES[day]}</span>
                    <div className="grid flex-1 grid-cols-[repeat(24,minmax(0,1fr))] gap-[3px]">
                      {row.map((count, hour) => (
                        <span
                          key={hour}
                          title={`${DAY_NAMES[day]}요일 ${hour}시, 커밋 ${count.toLocaleString('ko-KR')}개`}
                          className="h-5 rounded-[3px]"
                          style={{ background: tone(count, stats.hourMax) }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                <div className="mt-1.5 flex gap-2 text-[11px] text-gray-400 tabular-nums">
                  <span className="w-4 shrink-0" />
                  <div className="grid flex-1 grid-cols-[repeat(24,minmax(0,1fr))] gap-[3px]">
                    {Array.from({ length: 24 }, (_, hour) => (
                      <span key={hour} className="overflow-visible whitespace-nowrap">{hour % 6 === 0 ? `${hour}시` : ''}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className={card}>
            <h3 className={heading}>참여자별 흐름</h3>
            <p className={caption}>칸 하나가 한 주예요. 누가 언제 움직였는지 볼 수 있어요. 이름을 누르면 그 사람만 봐요.</p>
            <ul className="mt-4 space-y-1.5">
              {rows.map((row, order) => {
                const max = Math.max(0, ...row)
                const who = activity.people[order]
                const active = person === order
                return (
                  <li key={who.id} className={`flex items-center gap-3 ${person !== null && !active ? 'opacity-40' : ''}`}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        track('deep_activity_person', { repo, picked: !active })
                        setPerson(active ? null : order)
                      }}
                      className={`w-28 shrink-0 truncate text-left text-[13px] font-medium transition-colors hover:text-brand ${active ? 'text-brand-hover' : 'text-gray-800'}`}
                    >
                      {who.name}
                    </button>
                    <div className="flex min-w-0 flex-1 gap-[2px]">
                      {row.map((count, column) => (
                        <span
                          key={column}
                          title={`${shortDate(weeks[column])} 주, 커밋 ${count.toLocaleString('ko-KR')}개`}
                          className="h-5 min-w-0 flex-1 rounded-[2px]"
                          style={{ background: tone(count, max) }}
                        />
                      ))}
                    </div>
                    <span className="w-12 shrink-0 text-right text-[12px] text-gray-500 tabular-nums">{who.commits.toLocaleString('ko-KR')}</span>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>

        {activity.capped && <p className="px-1 text-[12.5px] text-gray-500">커밋이 많아서 최근 {activity.commits.length.toLocaleString('ko-KR')}개를 기준으로 그렸어요.</p>}
      </div>

      {/* 스크롤한 내용이 메뉴 뒤로 비치지 않게, 메뉴가 있는 줄에 바탕을 깔아요. */}
      <div className="absolute inset-x-0 top-0 flex h-16 items-center gap-2 bg-gray-50 px-4">
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
                  onSelect: () => {
                    track('deep_activity_person', { repo, picked: true })
                    setPerson(order)
                  },
                })),
              ],
            },
          ]}
        />
      </div>
    </div>
  )
}
