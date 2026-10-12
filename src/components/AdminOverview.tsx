import { useEffect, useState } from 'react'
import { track } from '../lib/analytics'
import { dayLabel, fetchOverview, type AdminOverview as Overview } from '../lib/admin'
import { BarChart, card, Empty, Failed, full, sectionTitle, Segmented, share, Stat, StatsSkeleton } from './AdminParts'

const PERIODS: [number, string][] = [
  [7, '7일'],
  [30, '30일'],
  [90, '90일'],
]

type Metric = 'chats' | 'signups'

const METRICS: [Metric, string][] = [
  ['chats', '새 채팅'],
  ['signups', '가입'],
]

type Loaded = 'loading' | { overview: Overview } | { error: string }

/** 관리자 화면의 현황 탭이에요. 회원, 사용 기기, 채팅의 합계와 날짜별 흐름, 많이 분석한 레포를 한눈에 보여줘요. */
export function AdminOverview() {
  const [period, setPeriod] = useState(30)
  const [metric, setMetric] = useState<Metric>('chats')
  const [loaded, setLoaded] = useState<Loaded>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let stale = false
    // 기간만 바꿀 때는 보던 숫자를 그대로 두고 그래프만 바꿔요.
    setLoaded((prev) => (typeof prev === 'object' && 'overview' in prev ? prev : 'loading'))
    void fetchOverview(period).then((result) => {
      if (stale) return
      setLoaded(result.ok ? { overview: result.data } : { error: result.message })
    })
    return () => {
      stale = true
    }
  }, [period, attempt])

  if (loaded === 'loading') {
    return (
      <div aria-busy="true">
        <span className="sr-only">불러오고 있어요.</span>
        <h2 className={sectionTitle}>회원</h2>
        <StatsSkeleton count={4} />
        <h2 className={`${sectionTitle} mt-8`}>사용 기기</h2>
        <StatsSkeleton count={3} />
        <h2 className={`${sectionTitle} mt-8`}>채팅</h2>
        <StatsSkeleton count={4} />
        <div aria-hidden className="mt-3 h-[244px] rounded-2xl bg-gray-100 motion-safe:animate-pulse" />
      </div>
    )
  }
  if ('error' in loaded) return <Failed message={loaded.error} onRetry={() => setAttempt((value) => value + 1)} />

  const { users, devices, chats, daily, topRepos } = loaded.overview
  const topCount = topRepos[0]?.chats ?? 0

  return (
    <>
      <h2 className={sectionTitle}>회원</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="전체 회원" value={full(users.total)} note={`오늘 ${full(users.today)}명 가입`} />
        <Stat label="최근 7일 가입" value={full(users.week)} />
        <Stat label="관리자" value={full(users.admins)} />
        <Stat label="정지된 회원" value={full(users.suspended)} />
      </dl>

      <h2 className={`${sectionTitle} mt-8`}>사용 기기</h2>
      <p className="mt-1 text-[12.5px] text-gray-500">그 기기로 한 번이라도 로그인한 회원 수예요. 한 회원이 여러 곳에 들어갈 수 있어요.</p>
      <dl className="mt-3 grid grid-cols-3 gap-3">
        <Stat label="앱" value={full(devices.app)} note={share(devices.app, users.total)} />
        <Stat label="모바일" value={full(devices.mobile)} note={share(devices.mobile, users.total)} />
        <Stat label="PC" value={full(devices.desktop)} note={share(devices.desktop, users.total)} />
      </dl>

      <h2 className={`${sectionTitle} mt-8`}>채팅</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="전체 채팅" value={full(chats.total)} note={`말풍선 ${full(chats.messages)}개`} />
        <Stat label="최근 7일" value={full(chats.week)} note={`오늘 ${full(chats.today)}개`} />
        <Stat label="공유 중" value={full(chats.shared)} note={share(chats.shared, chats.total)} />
        <Stat label="비회원 채팅" value={full(chats.anonymous)} note={share(chats.anonymous, chats.total)} />
      </dl>

      <section className={`${card} mt-3`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[13.5px] font-semibold text-gray-900">날짜별</h3>
          <div className="flex flex-wrap gap-2">
            <Segmented label="그래프에 보여줄 값" options={METRICS} value={metric} onChange={setMetric} />
            <Segmented
              label="기간"
              options={PERIODS}
              value={period}
              onChange={(value) => {
                track('admin_period_change', { tab: 'overview', days: value })
                setPeriod(value)
              }}
            />
          </div>
        </div>
        <BarChart
          bars={daily.map((day) => ({
            key: day.day,
            title: `${dayLabel(day.day)}, ${metric === 'chats' ? `새 채팅 ${full(day.chats)}개` : `가입 ${full(day.signups)}명`}`,
            value: day[metric],
          }))}
          label={`날짜별 ${metric === 'chats' ? '새 채팅' : '가입'} 그래프`}
          first={dayLabel(daily[0].day)}
          last={dayLabel(daily[daily.length - 1].day)}
        />
      </section>

      <h2 className={`${sectionTitle} mt-8`}>많이 분석한 레포</h2>
      {topRepos.length === 0 ? (
        <Empty>아직 분석한 레포가 없어요.</Empty>
      ) : (
        <ol className={`${card} mt-3 space-y-3`}>
          {topRepos.map((repo, index) => (
            <li key={repo.repoName} className="flex items-center gap-3 text-[13px]">
              <span className="w-5 shrink-0 text-right text-gray-400 tabular-nums">{index + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-gray-900">{repo.repoName}</span>
                <span className="mt-1.5 block h-1 rounded-full bg-gray-100">
                  <span className="block h-1 rounded-full bg-brand" style={{ width: `${(repo.chats / topCount) * 100}%` }} />
                </span>
              </span>
              <span className="w-12 shrink-0 text-right text-gray-700 tabular-nums">{full(repo.chats)}번</span>
            </li>
          ))}
        </ol>
      )}
    </>
  )
}
