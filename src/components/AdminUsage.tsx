import { useEffect, useMemo, useState } from 'react'
import { track } from '../lib/analytics'
import { addDays, dayLabel, daysBetween, fetchAiCalls, fetchAiUsage, monthLabel, seoulToday, type AiCall, type AiUsageRow } from '../lib/admin'
import { formatDateTime } from '../lib/format'
import { tag } from './DeepParts'
import { BarChart, card, compact, Empty, Failed, full, MoreButton, RowsSkeleton, sectionTitle, Segmented, share, Stat, StatsSkeleton, tableWrap, td, th, usePaged, type Bar } from './AdminParts'

type Period = 7 | 30 | 90 | 365 | 'all'

const PERIODS: [Period, string][] = [
  [7, '7일'],
  [30, '30일'],
  [90, '90일'],
  [365, '1년'],
  ['all', '전체'],
]

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

const purposeLabel = (purpose: string) => PURPOSE_LABELS[purpose] ?? purpose

/** 전체 기간을 볼 때 서버에 보내는 시작 날짜예요. 서비스가 생기기 전이라 모든 기록이 들어와요. */
const EARLIEST = '2000-01-01'
/** 날짜가 이보다 많으면 막대를 달마다 하나로 묶어요. */
const DAILY_LIMIT = 92

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

/** 관리자 화면의 AI 사용량 탭이에요. calls가 false면 서버에 호출 기록 API가 없어서 합계만 보여줘요. */
export function AdminUsage({ calls }: { calls: boolean }) {
  const [period, setPeriod] = useState<Period>(30)
  const [metric, setMetric] = useState<Metric>('tokens')
  const [loaded, setLoaded] = useState<Loaded>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let stale = false
    setLoaded('loading')
    const from = period === 'all' ? EARLIEST : addDays(seoulToday(), -(period - 1))
    void fetchAiUsage(from).then((result) => {
      if (stale) return
      setLoaded(result.ok ? { rows: result.data } : { error: result.message })
    })
    return () => {
      stale = true
    }
  }, [period, attempt])

  const rows = typeof loaded === 'object' && 'rows' in loaded ? loaded.rows : null

  const summary = useMemo(() => {
    if (!rows) return null
    const today = seoulToday()
    // 전체 기간은 기록이 처음 생긴 날부터 세요.
    const start = period === 'all' ? rows.reduce((first, row) => (row.day < first ? row.day : first), today) : addDays(today, -(period - 1))
    const days = daysBetween(start, today)
    const monthly = days.length > DAILY_LIMIT
    const total = { calls: 0, failedCalls: 0, inputTokens: 0, outputTokens: 0 }
    const buckets = new Map<string, { calls: number; tokens: number }>()
    for (const row of rows) {
      total.calls += row.calls
      total.failedCalls += row.failedCalls
      total.inputTokens += row.inputTokens
      total.outputTokens += row.outputTokens
      const key = monthly ? row.day.slice(0, 7) : row.day
      const bucket = buckets.get(key) ?? { calls: 0, tokens: 0 }
      bucket.calls += row.calls
      bucket.tokens += row.totalTokens
      buckets.set(key, bucket)
    }
    const keys = monthly ? [...new Set(days.map((day) => day.slice(0, 7)))] : days
    const label = monthly ? monthLabel : dayLabel
    return {
      total,
      dayCount: days.length,
      monthly,
      series: keys.map((key) => ({ key, label: label(key), ...(buckets.get(key) ?? { calls: 0, tokens: 0 }) })),
      purposes: groupBy(rows, (row) => purposeLabel(row.purpose)),
      models: groupBy(rows, (row) => row.model),
    }
  }, [rows, period])

  const bars: Bar[] =
    summary?.series.map((item) => ({
      key: item.key,
      title: `${item.label}, ${metric === 'tokens' ? `${full(item.tokens)} 토큰` : `${full(item.calls)}번`}`,
      value: item[metric],
    })) ?? []

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={sectionTitle}>AI 사용량</h2>
        <Segmented
          label="기간"
          options={PERIODS}
          value={period}
          onChange={(value) => {
            track('admin_period_change', { tab: 'ai', days: value })
            setPeriod(value)
          }}
        />
      </div>

      {loaded === 'loading' ? (
        <div aria-busy="true">
          <span className="sr-only">불러오고 있어요.</span>
          <StatsSkeleton count={4} />
          <div aria-hidden className="mt-3 h-[244px] rounded-2xl bg-gray-100 motion-safe:animate-pulse" />
          <div aria-hidden className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="h-44 rounded-2xl bg-gray-100 motion-safe:animate-pulse" />
            <div className="h-44 rounded-2xl bg-gray-100 motion-safe:animate-pulse" />
          </div>
        </div>
      ) : !summary ? (
        <Failed message={'error' in loaded ? loaded.error : ''} onRetry={() => setAttempt((value) => value + 1)} />
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="호출" value={full(summary.total.calls)} note={`하루에 ${full(Math.round(summary.total.calls / summary.dayCount))}번쯤`} />
            <Stat label="실패한 호출" value={full(summary.total.failedCalls)} note={share(summary.total.failedCalls, summary.total.calls)} />
            <Stat label="입력 토큰" value={compact(summary.total.inputTokens)} note={full(summary.total.inputTokens)} />
            <Stat label="출력 토큰" value={compact(summary.total.outputTokens)} note={full(summary.total.outputTokens)} />
          </dl>

          {summary.total.calls === 0 ? (
            <Empty>이 기간에는 AI를 쓴 기록이 없어요.</Empty>
          ) : (
            <>
              <section className={`${card} mt-3`}>
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-[13.5px] font-semibold text-gray-900">{summary.monthly ? '달별' : '날짜별'}</h3>
                  <Segmented label="그래프에 보여줄 값" options={METRICS} value={metric} onChange={setMetric} />
                </div>
                <BarChart
                  bars={bars}
                  label={`${summary.monthly ? '달별' : '날짜별'} ${metric === 'tokens' ? '토큰' : '호출'} 그래프`}
                  first={summary.series[0].label}
                  last={summary.series[summary.series.length - 1].label}
                />
              </section>

              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <Breakdown title="목적별" groups={summary.purposes} />
                <Breakdown title="모델별" groups={summary.models} mono />
              </div>
            </>
          )}
        </>
      )}

      {calls && <Calls />}
    </>
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

const CALL_FILTERS: ['all' | 'failed', string][] = [
  ['all', '전체'],
  ['failed', '실패만'],
]

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}초`

/** 최근에 AI를 부른 기록이에요. 어떤 호출이 실패했는지, 얼마나 걸렸는지 봐요. */
function Calls() {
  const [filter, setFilter] = useState<'all' | 'failed'>('all')
  const list = usePaged<AiCall>((page) => fetchAiCalls(filter === 'failed', page), filter)

  return (
    <>
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <h2 className={sectionTitle}>최근 호출</h2>
        <Segmented label="호출 종류" options={CALL_FILTERS} value={filter} onChange={setFilter} />
      </div>

      {list.items === null ? (
        list.error ? (
          <Failed message={list.error} onRetry={list.retry} />
        ) : (
          <RowsSkeleton rows={6} />
        )
      ) : list.items.length === 0 ? (
        <Empty>{filter === 'failed' ? '실패한 호출이 없어요.' : '아직 AI를 쓴 기록이 없어요.'}</Empty>
      ) : (
        <>
          <div className={tableWrap}>
            <table className="w-full min-w-[720px] text-[13px] text-gray-700 tabular-nums">
              <thead>
                <tr>
                  <th className={th}>때</th>
                  <th className={th}>목적</th>
                  <th className={th}>내용</th>
                  <th className={th}>모델</th>
                  <th className={`${th} text-right`}>토큰</th>
                  <th className={`${th} text-right`}>걸린 시간</th>
                  <th className={th}>결과</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((call) => (
                  <tr key={call.id} className="border-t border-gray-100">
                    <td className={`${td} whitespace-nowrap text-gray-500`}>{formatDateTime(call.createdAt)}</td>
                    <td className={`${td} whitespace-nowrap`}>{purposeLabel(call.purpose)}</td>
                    <td className={`${td} max-w-[260px]`}>
                      <p className="truncate text-gray-900" title={call.label ?? undefined}>
                        {call.label ?? ''}
                      </p>
                      {call.error && (
                        <p className="mt-0.5 truncate text-[12px] text-red-500" title={call.error}>
                          {call.error}
                        </p>
                      )}
                    </td>
                    <td className={`${td} font-mono text-[12.5px] tracking-normal whitespace-nowrap`}>{call.model}</td>
                    <td className={`${td} text-right`}>{call.totalTokens === null ? '' : full(call.totalTokens)}</td>
                    <td className={`${td} text-right`}>{seconds(call.durationMs)}</td>
                    <td className={td}>{call.status === 'OK' ? <span className={tag}>성공</span> : <span className={`${tag} text-red-500`}>실패</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {list.hasNext && <MoreButton loading={list.loadingMore} onClick={() => void list.more()} />}
        </>
      )}
    </>
  )
}
