import { useEffect, useMemo, useState } from 'react'
import { track } from '../lib/analytics'
import { fetchAiUsage, isAdmin, useAuth, type AiUsageRow } from '../lib/auth'
import { toolButton } from './DeepParts'
import { Bone } from './Skeleton'

const PERIODS = [7, 30, 90] as const
type Period = (typeof PERIODS)[number]

type Metric = 'tokens' | 'calls'

const METRICS: [Metric, string][] = [
  ['tokens', '토큰'],
  ['calls', '호출'],
]

/** 서버가 보내는 목적 이름을 화면에 보여줄 말로 바꿔요. 모르는 값은 그대로 보여줘요. */
const PURPOSE_LABELS: Record<string, string> = {
  REPO_SUMMARY: '레포 소개',
  CONTRIBUTOR_PROFILE: '참여자 분석',
  NARRATION: '해설',
}

const DAY_MS = 86_400_000
// 서버는 사용량을 한국 날짜로 묶어서, 화면도 한국 날짜로 기간을 세요.
const seoulDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })

/** 오늘까지 최근 며칠의 날짜(YYYY-MM-DD)를 오래된 순서로 돌려줘요. */
function recentDays(count: number): string[] {
  const now = Date.now()
  return Array.from({ length: count }, (_, index) => seoulDay.format(now - (count - 1 - index) * DAY_MS))
}

function dayLabel(day: string): string {
  const [, month, date] = day.split('-')
  return `${Number(month)}월 ${Number(date)}일`
}

const full = (value: number) => value.toLocaleString('ko-KR')
const compactFormat = new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 })
const compact = (value: number) => compactFormat.format(value)

interface Group {
  name: string
  calls: number
  failedCalls: number
  totalTokens: number
}

function groupBy(rows: AiUsageRow[], key: (row: AiUsageRow) => string): Group[] {
  const groups = new Map<string, Group>()
  for (const row of rows) {
    const name = key(row)
    const group = groups.get(name) ?? { name, calls: 0, failedCalls: 0, totalTokens: 0 }
    group.calls += row.calls
    group.failedCalls += row.failedCalls
    group.totalTokens += row.totalTokens
    groups.set(name, group)
  }
  return [...groups.values()].sort((a, b) => b.totalTokens - a.totalTokens || b.calls - a.calls)
}

type Loaded = 'loading' | { rows: AiUsageRow[] } | { error: string }

const segment = (active: boolean) =>
  `h-7 rounded-md px-2.5 text-[12.5px] font-medium transition-colors ${active ? 'bg-white text-gray-900' : 'text-gray-500 hover:text-gray-900'}`
const card = 'rounded-2xl border border-gray-200 bg-white p-4'

/** 앱에서 관리자 계정만 보는 화면이에요. 서버가 남긴 AI 사용량을 기간별로 보여줘요. */
export function Admin() {
  const { me } = useAuth()
  const allowed = me === null || isAdmin(me)
  const [period, setPeriod] = useState<Period>(30)
  const [metric, setMetric] = useState<Metric>('tokens')
  const [loaded, setLoaded] = useState<Loaded>('loading')
  const [attempt, setAttempt] = useState(0)
  const days = useMemo(() => recentDays(period), [period])

  useEffect(() => {
    if (!allowed) return
    let stale = false
    setLoaded('loading')
    void fetchAiUsage(days[0]).then((result) => {
      if (stale) return
      setLoaded(result.ok ? { rows: result.data } : { error: result.message })
    })
    return () => {
      stale = true
    }
  }, [allowed, days, attempt])

  const rows = typeof loaded === 'object' && 'rows' in loaded ? loaded.rows : null

  const summary = useMemo(() => {
    if (!rows) return null
    const total = { calls: 0, failedCalls: 0, inputTokens: 0, outputTokens: 0 }
    const byDay = new Map<string, { calls: number; tokens: number }>()
    for (const row of rows) {
      total.calls += row.calls
      total.failedCalls += row.failedCalls
      total.inputTokens += row.inputTokens
      total.outputTokens += row.outputTokens
      const day = byDay.get(row.day) ?? { calls: 0, tokens: 0 }
      day.calls += row.calls
      day.tokens += row.totalTokens
      byDay.set(row.day, day)
    }
    return {
      total,
      series: days.map((day) => ({ day, ...(byDay.get(day) ?? { calls: 0, tokens: 0 }) })),
      purposes: groupBy(rows, (row) => PURPOSE_LABELS[row.purpose] ?? row.purpose),
      models: groupBy(rows, (row) => row.model),
    }
  }, [rows, days])

  if (!allowed) {
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
        <p className="text-[14px] leading-relaxed text-gray-600">관리자 계정만 볼 수 있는 화면이에요.</p>
      </main>
    )
  }

  const peak = summary ? Math.max(...summary.series.map((day) => day[metric])) : 0
  const failedShare = summary && summary.total.calls > 0 ? (summary.total.failedCalls / summary.total.calls) * 100 : 0

  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-6 pt-14 pb-10 md:px-10">
      <div className="flex items-center justify-between gap-4 pt-6">
        <h1 className="text-[22px] leading-snug font-semibold text-gray-900">관리자</h1>
        <div role="radiogroup" aria-label="기간" className="inline-flex rounded-lg bg-gray-100 p-0.5">
          {PERIODS.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={period === value}
              onClick={() => {
                if (period === value) return
                track('admin_period_change', { days: value })
                setPeriod(value)
              }}
              className={segment(period === value)}
            >
              최근 {value}일
            </button>
          ))}
        </div>
      </div>

      <h2 className="mt-8 text-[15px] font-semibold text-gray-900">AI 사용량</h2>

      {loaded === 'loading' ? (
        <div aria-busy="true">
          <span className="sr-only">불러오고 있어요.</span>
          <div aria-hidden className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className={card}>
                <Bone className="h-3 w-16" />
                <Bone className="mt-3 h-6 w-24" />
                <Bone className="mt-3 h-3 w-20" />
              </div>
            ))}
          </div>
          <div aria-hidden className="mt-3 h-[244px] rounded-2xl bg-gray-100 motion-safe:animate-pulse" />
          <div aria-hidden className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="h-44 rounded-2xl bg-gray-100 motion-safe:animate-pulse" />
            <div className="h-44 rounded-2xl bg-gray-100 motion-safe:animate-pulse" />
          </div>
        </div>
      ) : !summary ? (
        <div className="mt-16 flex flex-col items-center gap-4 text-center">
          <p className="text-[14px] leading-relaxed text-gray-600">{'error' in loaded ? loaded.error : ''}</p>
          <button type="button" onClick={() => setAttempt((value) => value + 1)} className={toolButton}>
            다시 시도하기
          </button>
        </div>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="호출" value={full(summary.total.calls)} note={`하루에 ${full(Math.round(summary.total.calls / period))}번쯤`} />
            <Stat label="실패한 호출" value={full(summary.total.failedCalls)} note={`전체의 ${failedShare.toFixed(1)}%`} />
            <Stat label="입력 토큰" value={compact(summary.total.inputTokens)} note={full(summary.total.inputTokens)} />
            <Stat label="출력 토큰" value={compact(summary.total.outputTokens)} note={full(summary.total.outputTokens)} />
          </dl>

          {summary.total.calls === 0 ? (
            <p className="mt-16 text-center text-[14px] leading-relaxed text-gray-600">이 기간에는 AI를 쓴 기록이 없어요.</p>
          ) : (
            <>
              <section className={`${card} mt-3`}>
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-[13.5px] font-semibold text-gray-900">날짜별</h3>
                  <div role="radiogroup" aria-label="그래프에 보여줄 값" className="inline-flex rounded-lg bg-gray-100 p-0.5">
                    {METRICS.map(([value, label]) => (
                      <button key={value} type="button" role="radio" aria-checked={metric === value} onClick={() => setMetric(value)} className={segment(metric === value)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div
                  role="img"
                  aria-label={`최근 ${period}일의 날짜별 ${metric === 'tokens' ? '토큰' : '호출'} 그래프`}
                  className={`mt-4 flex h-40 items-end ${period > 30 ? 'gap-px' : 'gap-1'}`}
                >
                  {summary.series.map((day) => (
                    <div
                      key={day.day}
                      title={`${dayLabel(day.day)}, ${metric === 'tokens' ? `${full(day.tokens)} 토큰` : `${full(day.calls)}번`}`}
                      className="flex h-full min-w-0 flex-1 items-end rounded-sm transition-colors hover:bg-gray-100"
                    >
                      <div className="w-full rounded-t-sm bg-brand" style={{ height: day[metric] > 0 ? `${Math.max((day[metric] / peak) * 100, 2)}%` : 0 }} />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[12px] text-gray-400 tabular-nums">
                  <span>{dayLabel(days[0])}</span>
                  <span>{dayLabel(days[days.length - 1])}</span>
                </div>
              </section>

              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <Breakdown title="목적별" groups={summary.purposes} />
                <Breakdown title="모델별" groups={summary.models} mono />
              </div>
            </>
          )}
        </>
      )}
    </main>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className={card}>
      <dt className="text-[12.5px] text-gray-500">{label}</dt>
      <dd className="mt-1.5 text-[22px] leading-tight font-semibold text-gray-900 tabular-nums">{value}</dd>
      <dd className="mt-1 text-[12px] text-gray-400 tabular-nums">{note}</dd>
    </div>
  )
}

function Breakdown({ title, groups, mono = false }: { title: string; groups: Group[]; mono?: boolean }) {
  return (
    <section className={card}>
      <h3 className="text-[13.5px] font-semibold text-gray-900">{title}</h3>
      <table className="mt-2 w-full text-[13px] tabular-nums">
        <thead>
          <tr className="text-left text-[12px] text-gray-400">
            <th className="py-1.5 font-medium">이름</th>
            <th className="py-1.5 text-right font-medium">호출</th>
            <th className="py-1.5 text-right font-medium">실패</th>
            <th className="py-1.5 text-right font-medium">토큰</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.name} className="border-t border-gray-100 text-gray-700">
              <td className={`py-2 pr-3 break-all text-gray-900 ${mono ? 'font-mono text-[12.5px] tracking-normal' : ''}`}>{group.name}</td>
              <td className="w-14 py-2 text-right align-top">{full(group.calls)}</td>
              <td className="w-12 py-2 text-right align-top">{full(group.failedCalls)}</td>
              <td className="w-16 py-2 text-right align-top" title={full(group.totalTokens)}>
                {compact(group.totalTokens)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
