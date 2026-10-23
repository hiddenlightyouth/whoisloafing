import { useCallback, useEffect, useMemo, useState } from 'react'
import { track } from '../lib/analytics'
import { addDays, dayLabel, daysBetween, fetchAiCall, fetchAiCalls, fetchAiUsage, monthLabel, seoulToday, type AiCall, type AiCallDetail, type AiUsageRow } from '../lib/admin'
import { formatDateTime } from '../lib/format'
import { showToast } from '../lib/toast'
import { tag } from './DeepParts'
import { BarChart, card, compact, Empty, Failed, full, MoreButton, rowButton, RowsSkeleton, sectionTitle, Segmented, share, Stat, StatsSkeleton, tableWrap, td, th, usePaged, type Bar } from './AdminParts'
import { Bone } from './Skeleton'
import { messages, pick, useMessages } from '../lib/i18n'
import { CloseButton } from './Icons'

type Period = 7 | 30 | 90 | 365 | 'all'

type Metric = 'tokens' | 'calls'

const TEXT = messages({
  ko: {
    periods: [[7, '7일'], [30, '30일'], [90, '90일'], [365, '1년'], ['all', '전체']] as [Period, string][],
    metrics: [['tokens', '토큰'], ['calls', '호출']] as [Metric, string][],
    callFilters: [['all', '전체'], ['failed', '실패만']] as ['all' | 'failed', string][],
    /** 서버가 보내는 목적 이름을 화면에 보여줄 말로 바꿔요. 모르는 값은 그대로 보여줘요. */
    purposes: { REPO_SUMMARY: '레포 소개', CONTRIBUTOR_PROFILE: '참여자 분석', NARRATION: '해설', PORTFOLIO: '포트폴리오' } as Record<string, string>,
    tokensBar: (n: string) => `${n} 토큰`,
    callsBar: (n: string) => `${n}번`,
    title: 'AI 사용량',
    period: '기간',
    loading: '불러오고 있어요.',
    calls: '호출',
    perDay: (n: string) => `하루에 ${n}번쯤`,
    failedCalls: '실패한 호출',
    inputTokens: '입력 토큰',
    outputTokens: '출력 토큰',
    noUsage: '이 기간에는 AI를 쓴 기록이 없어요.',
    monthly: '달별',
    daily: '날짜별',
    metric: '그래프에 보여줄 값',
    chart: (monthly: boolean, metric: Metric) => `${monthly ? '달별' : '날짜별'} ${metric === 'tokens' ? '토큰' : '호출'} 그래프`,
    byPurpose: '목적별',
    byModel: '모델별',
    name: '이름',
    failed: '실패',
    tokens: '토큰',
    seconds: (n: string) => `${n}초`,
    recent: '최근 호출',
    callKind: '호출 종류',
    noFailed: '실패한 호출이 없어요.',
    noCalls: '아직 AI를 쓴 기록이 없어요.',
    when: '때',
    purpose: '목적',
    content: '내용',
    model: '모델',
    duration: '걸린 시간',
    result: '결과',
    detail: (purpose: string) => `${purpose} 호출 자세히 보기`,
    ok: '성공',
    copyFailed: '복사하지 못했어요.',
    copied: '복사했어요',
    copy: '복사',
    panel: 'AI 호출 자세히 보기',
    close: '닫기',
    calledAt: '호출한 때',
    unknown: '모름',
    error: '오류',
    system: '입력: 시스템',
    user: '입력: 사용자',
    output: '출력',
    chars: (n: string) => `${n}자`,
    noSystem: '시스템 프롬프트가 없어요.',
    noUser: '사용자 프롬프트가 없어요.',
    noResponse: '받은 응답이 없어요.',
  },
  en: {
    periods: [[7, '7 days'], [30, '30 days'], [90, '90 days'], [365, '1 year'], ['all', 'All']],
    metrics: [['tokens', 'Tokens'], ['calls', 'Calls']],
    callFilters: [['all', 'All'], ['failed', 'Failed only']],
    purposes: { REPO_SUMMARY: 'Repo summary', CONTRIBUTOR_PROFILE: 'Contributor analysis', NARRATION: 'Narration', PORTFOLIO: 'Portfolio' },
    tokensBar: (n: string) => `${n} tokens`,
    callsBar: (n: string) => `${n} calls`,
    title: 'AI usage',
    period: 'Period',
    loading: 'Loading.',
    calls: 'Calls',
    perDay: (n: string) => `About ${n} a day`,
    failedCalls: 'Failed calls',
    inputTokens: 'Input tokens',
    outputTokens: 'Output tokens',
    noUsage: 'No AI usage in this period.',
    monthly: 'By month',
    daily: 'By day',
    metric: 'Chart value',
    chart: (monthly: boolean, metric: Metric) => `${metric === 'tokens' ? 'Tokens' : 'Calls'} ${monthly ? 'by month' : 'by day'}`,
    byPurpose: 'By purpose',
    byModel: 'By model',
    name: 'Name',
    failed: 'Failed',
    tokens: 'Tokens',
    seconds: (n: string) => `${n}s`,
    recent: 'Recent calls',
    callKind: 'Call type',
    noFailed: 'No failed calls.',
    noCalls: 'No AI usage yet.',
    when: 'When',
    purpose: 'Purpose',
    content: 'Content',
    model: 'Model',
    duration: 'Duration',
    result: 'Result',
    detail: (purpose: string) => `View ${purpose} call`,
    ok: 'OK',
    copyFailed: "Couldn't copy.",
    copied: 'Copied',
    copy: 'Copy',
    panel: 'AI call details',
    close: 'Close',
    calledAt: 'Called at',
    unknown: 'Unknown',
    error: 'Error',
    system: 'Input: system',
    user: 'Input: user',
    output: 'Output',
    chars: (n: string) => `${n} chars`,
    noSystem: 'No system prompt.',
    noUser: 'No user prompt.',
    noResponse: 'No response received.',
  },
})

const purposeLabel = (purpose: string) => pick(TEXT).purposes[purpose] ?? purpose

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
  const L = useMessages(TEXT)
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
  }, [rows, period, L])

  const bars: Bar[] =
    summary?.series.map((item) => ({
      key: item.key,
      title: `${item.label}, ${metric === 'tokens' ? L.tokensBar(full(item.tokens)) : L.callsBar(full(item.calls))}`,
      value: item[metric],
    })) ?? []

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={sectionTitle}>{L.title}</h2>
        <Segmented
          label={L.period}
          options={L.periods}
          value={period}
          onChange={(value) => {
            track('admin_period_change', { tab: 'ai', days: value })
            setPeriod(value)
          }}
        />
      </div>

      {loaded === 'loading' ? (
        <div aria-busy="true">
          <span className="sr-only">{L.loading}</span>
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
            <Stat label={L.calls} value={full(summary.total.calls)} note={L.perDay(full(Math.round(summary.total.calls / summary.dayCount)))} />
            <Stat label={L.failedCalls} value={full(summary.total.failedCalls)} note={share(summary.total.failedCalls, summary.total.calls)} />
            <Stat label={L.inputTokens} value={compact(summary.total.inputTokens)} note={full(summary.total.inputTokens)} />
            <Stat label={L.outputTokens} value={compact(summary.total.outputTokens)} note={full(summary.total.outputTokens)} />
          </dl>

          {summary.total.calls === 0 ? (
            <Empty>{L.noUsage}</Empty>
          ) : (
            <>
              <section className={`${card} mt-3`}>
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-[13.5px] font-semibold text-gray-900">{summary.monthly ? L.monthly : L.daily}</h3>
                  <Segmented label={L.metric} options={L.metrics} value={metric} onChange={setMetric} />
                </div>
                <BarChart
                  bars={bars}
                  label={L.chart(summary.monthly, metric)}
                  first={summary.series[0].label}
                  last={summary.series[summary.series.length - 1].label}
                />
              </section>

              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <Breakdown title={L.byPurpose} groups={summary.purposes} />
                <Breakdown title={L.byModel} groups={summary.models} mono />
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
  const L = useMessages(TEXT)
  return (
    <section className={card}>
      <h3 className="text-[13.5px] font-semibold text-gray-900">{title}</h3>
      <table className="mt-2 w-full text-[13px] tabular-nums">
        <thead>
          <tr className="text-left text-[12px] text-gray-400">
            <th className="py-1.5 font-medium">{L.name}</th>
            <th className="py-1.5 text-right font-medium">{L.calls}</th>
            <th className="py-1.5 text-right font-medium">{L.failed}</th>
            <th className="py-1.5 text-right font-medium">{L.tokens}</th>
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



const seconds = (ms: number) => pick(TEXT).seconds((ms / 1000).toFixed(1))

/** 최근에 AI를 부른 기록이에요. 어떤 호출이 실패했는지, 얼마나 걸렸는지 보고, 줄을 누르면 넣은 프롬프트와 받은 응답을 봐요. */
function Calls() {
  const L = useMessages(TEXT)
  const [filter, setFilter] = useState<'all' | 'failed'>('all')
  const list = usePaged<AiCall>((page) => fetchAiCalls(filter === 'failed', page), filter)
  const [openId, setOpenId] = useState<number | null>(null)
  const close = useCallback(() => setOpenId(null), [])

  return (
    <>
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <h2 className={sectionTitle}>{L.recent}</h2>
        <Segmented label={L.callKind} options={L.callFilters} value={filter} onChange={setFilter} />
      </div>

      {list.items === null ? (
        list.error ? (
          <Failed message={list.error} onRetry={list.retry} />
        ) : (
          <RowsSkeleton rows={6} />
        )
      ) : list.items.length === 0 ? (
        <Empty>{filter === 'failed' ? L.noFailed : L.noCalls}</Empty>
      ) : (
        <>
          <div className={tableWrap}>
            <table className="w-full min-w-[720px] text-[13px] text-gray-700 tabular-nums">
              <thead>
                <tr>
                  <th className={th}>{L.when}</th>
                  <th className={th}>{L.purpose}</th>
                  <th className={th}>{L.content}</th>
                  <th className={th}>{L.model}</th>
                  <th className={`${th} text-right`}>{L.tokens}</th>
                  <th className={`${th} text-right`}>{L.duration}</th>
                  <th className={th}>{L.result}</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((call) => (
                  <tr
                    key={call.id}
                    tabIndex={0}
                    aria-label={L.detail(purposeLabel(call.purpose))}
                    onClick={() => {
                      track('admin_call_open', { status: call.status })
                      setOpenId(call.id)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') setOpenId(call.id)
                    }}
                    className={`cursor-pointer border-t border-gray-100 transition-colors hover:bg-gray-50 ${openId === call.id ? 'bg-gray-50' : ''}`}
                  >
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
                    <td className={td}>{call.status === 'OK' ? <span className={tag}>{L.ok}</span> : <span className={`${tag} text-red-500`}>{L.failed}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {list.hasNext && <MoreButton loading={list.loadingMore} onClick={() => void list.more()} />}
        </>
      )}

      {openId !== null && <CallPanel key={openId} id={openId} onClose={close} />}
    </>
  )
}

/** 응답이 JSON이면 읽기 좋게 줄을 나눠요. 아니면 받은 그대로 보여줘요. */
function pretty(text: string): string {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return text
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2)
  } catch {
    return text
  }
}

/** 프롬프트나 응답 한 덩어리를 원문 그대로 보여주는 칸이에요. */
function Passage({ title, note, text, empty }: { title: string; note?: string; text: string | null; empty: string }) {
  const L = useMessages(TEXT)
  const [copied, setCopied] = useState(false)

  async function copy() {
    if (!text) return
    const ok = await navigator.clipboard.writeText(text).then(
      () => true,
      () => false,
    )
    track('admin_call_copy', { part: title, success: ok })
    if (!ok) {
      showToast(pick(TEXT).copyFailed)
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex min-w-0 items-baseline gap-2 text-[13.5px] font-semibold text-gray-900">
          {title}
          {note && <span className="truncate text-[12px] font-normal text-gray-400 tabular-nums">{note}</span>}
        </h3>
        {text && (
          <button type="button" onClick={() => void copy()} className={rowButton}>
            {copied ? L.copied : L.copy}
          </button>
        )}
      </div>
      {text ? (
        <pre className="mt-2 max-h-[55dvh] overflow-auto rounded-lg bg-gray-50 p-3 font-mono text-[12.5px] leading-[20px] tracking-normal break-words whitespace-pre-wrap text-gray-700">{text}</pre>
      ) : (
        <p className="mt-2 text-[13px] text-gray-500">{empty}</p>
      )}
    </section>
  )
}

/** AI 호출 하나를 오른쪽에서 열어 보는 칸이에요. 넣은 것을 시스템과 사용자로 나눠서, 받은 것을 그 아래에 보여줘요. */
function CallPanel({ id, onClose }: { id: number; onClose: () => void }) {
  const L = useMessages(TEXT)
  const [call, setCall] = useState<AiCallDetail | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let stale = false
    void fetchAiCall(id).then((result) => {
      if (stale) return
      if (result.ok) {
        setError('')
        setCall(result.data)
      } else setError(result.message)
    })
    return () => {
      stale = true
    }
  }, [id, attempt])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <>
      <div className="fixed inset-0 z-20" onPointerDown={onClose} aria-hidden />
      <aside aria-label={L.panel} className="fixed inset-y-0 right-0 z-30 flex w-full max-w-[640px] animate-slide-in flex-col border-l border-gray-200 bg-white">
        <div className="flex h-14 shrink-0 items-center justify-end px-4">
          <CloseButton label={L.close} onClick={onClose} size="md" />
        </div>

        {!call ? (
          error ? (
            <Failed message={error} onRetry={() => setAttempt((value) => value + 1)} />
          ) : (
            <div aria-busy="true" className="px-6">
              <span className="sr-only">{L.loading}</span>
              <Bone className="h-5 w-40" />
              <Bone className="mt-2.5 h-3.5 w-56" />
              <div aria-hidden className="mt-8 h-32 rounded-lg bg-gray-100 motion-safe:animate-pulse" />
              <div aria-hidden className="mt-6 h-48 rounded-lg bg-gray-100 motion-safe:animate-pulse" />
            </div>
          )
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8">
            <h2 className="text-[20px] leading-tight font-semibold break-keep text-gray-900 [overflow-wrap:anywhere]">{call.label || purposeLabel(call.purpose)}</h2>
            <div className="mt-3 flex flex-wrap gap-1">
              <span className={tag}>{purposeLabel(call.purpose)}</span>
              <span className={`${tag} font-mono tracking-normal`}>{call.model}</span>
              {call.status === 'OK' ? <span className={tag}>{L.ok}</span> : <span className={`${tag} text-red-500`}>{L.failed}</span>}
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-[13px] sm:grid-cols-4">
              {[
                [L.calledAt, formatDateTime(call.createdAt)],
                [L.duration, seconds(call.durationMs)],
                [L.inputTokens, call.inputTokens === null ? L.unknown : full(call.inputTokens)],
                [L.outputTokens, call.outputTokens === null ? L.unknown : full(call.outputTokens)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[12px] text-gray-400">{label}</dt>
                  <dd className="mt-0.5 text-gray-900 tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>

            {call.error && (
              <section className="mt-6">
                <h3 className="text-[13.5px] font-semibold text-red-500">{L.error}</h3>
                <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-gray-50 p-3 font-mono text-[12.5px] leading-[20px] tracking-normal break-words whitespace-pre-wrap text-gray-700">{call.error}</pre>
              </section>
            )}

            <Passage title={L.system} note={L.chars(full(call.systemPrompt.length))} text={call.systemPrompt} empty={L.noSystem} />
            <Passage title={L.user} note={L.chars(full(call.userPrompt.length))} text={call.userPrompt} empty={L.noUser} />
            <Passage
              title={L.output}
              note={call.response ? L.chars(full(call.response.length)) : undefined}
              text={call.response ? pretty(call.response) : null}
              empty={L.noResponse}
            />
          </div>
        )}
      </aside>
    </>
  )
}
