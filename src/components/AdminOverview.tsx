import { useEffect, useState } from 'react'
import { track } from '../lib/analytics'
import { dayLabel, fetchOverview, type AdminOverview as Overview } from '../lib/admin'
import { BarChart, card, Empty, Failed, full, sectionTitle, Segmented, share, Stat, StatsSkeleton } from './AdminParts'
import { messages, useMessages } from '../lib/i18n'

type Metric = 'chats' | 'signups'

const TEXT = messages({
  ko: {
    periods: [[7, '7일'], [30, '30일'], [90, '90일']] as [number, string][],
    metrics: [['chats', '새 채팅'], ['signups', '가입']] as [Metric, string][],
    loading: '불러오고 있어요.',
    users: '회원',
    devices: '사용 기기',
    chats: '채팅',
    totalUsers: '전체 회원',
    joinedToday: (n: string) => `오늘 ${n}명 가입`,
    week: '최근 7일 가입',
    admins: '관리자',
    suspended: '정지된 회원',
    devicesNote: '그 기기로 한 번이라도 로그인한 회원 수예요. 한 회원이 여러 곳에 들어갈 수 있어요.',
    app: '앱',
    mobile: '모바일',
    desktop: 'PC',
    totalChats: '전체 채팅',
    bubbles: (n: string) => `말풍선 ${n}개`,
    chatsWeek: '최근 7일',
    chatsToday: (n: string) => `오늘 ${n}개`,
    shared: '공유 중',
    anonymous: '비회원 채팅',
    daily: '날짜별',
    metric: '그래프에 보여줄 값',
    period: '기간',
    barChats: (n: string) => `새 채팅 ${n}개`,
    barSignups: (n: string) => `가입 ${n}명`,
    chart: (metric: Metric) => `날짜별 ${metric === 'chats' ? '새 채팅' : '가입'} 그래프`,
    topRepos: '많이 분석한 레포',
    noRepos: '아직 분석한 레포가 없어요.',
    times: (n: string) => `${n}번`,
  },
  en: {
    periods: [[7, '7 days'], [30, '30 days'], [90, '90 days']],
    metrics: [['chats', 'New chats'], ['signups', 'Sign-ups']],
    loading: 'Loading.',
    users: 'Members',
    devices: 'Devices',
    chats: 'Chats',
    totalUsers: 'All members',
    joinedToday: (n: string) => `${n} joined today`,
    week: 'Joined in 7 days',
    admins: 'Admins',
    suspended: 'Suspended',
    devicesNote: 'Members who have signed in on that device at least once. One member can count in several.',
    app: 'App',
    mobile: 'Mobile',
    desktop: 'Desktop',
    totalChats: 'All chats',
    bubbles: (n: string) => `${n} messages`,
    chatsWeek: 'Last 7 days',
    chatsToday: (n: string) => `${n} today`,
    shared: 'Shared',
    anonymous: 'Guest chats',
    daily: 'By day',
    metric: 'Chart value',
    period: 'Period',
    barChats: (n: string) => `${n} new chats`,
    barSignups: (n: string) => `${n} sign-ups`,
    chart: (metric: Metric) => `${metric === 'chats' ? 'New chats' : 'Sign-ups'} by day`,
    topRepos: 'Most analyzed repos',
    noRepos: 'No repos have been analyzed yet.',
    times: (n: string) => `${n}x`,
  },
})

type Loaded = 'loading' | { overview: Overview } | { error: string }

/** 관리자 화면의 현황 탭이에요. 회원, 사용 기기, 채팅의 합계와 날짜별 흐름, 많이 분석한 레포를 한눈에 보여줘요. */
export function AdminOverview() {
  const L = useMessages(TEXT)
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
        <span className="sr-only">{L.loading}</span>
        <h2 className={sectionTitle}>{L.users}</h2>
        <StatsSkeleton count={4} />
        <h2 className={`${sectionTitle} mt-8`}>{L.devices}</h2>
        <StatsSkeleton count={3} />
        <h2 className={`${sectionTitle} mt-8`}>{L.chats}</h2>
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
      <h2 className={sectionTitle}>{L.users}</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={L.totalUsers} value={full(users.total)} note={L.joinedToday(full(users.today))} />
        <Stat label={L.week} value={full(users.week)} />
        <Stat label={L.admins} value={full(users.admins)} />
        <Stat label={L.suspended} value={full(users.suspended)} />
      </dl>

      <h2 className={`${sectionTitle} mt-8`}>{L.devices}</h2>
      <p className="mt-1 text-[12.5px] text-gray-500">{L.devicesNote}</p>
      <dl className="mt-3 grid grid-cols-3 gap-3">
        <Stat label={L.app} value={full(devices.app)} note={share(devices.app, users.total)} />
        <Stat label={L.mobile} value={full(devices.mobile)} note={share(devices.mobile, users.total)} />
        <Stat label={L.desktop} value={full(devices.desktop)} note={share(devices.desktop, users.total)} />
      </dl>

      <h2 className={`${sectionTitle} mt-8`}>{L.chats}</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={L.totalChats} value={full(chats.total)} note={L.bubbles(full(chats.messages))} />
        <Stat label={L.chatsWeek} value={full(chats.week)} note={L.chatsToday(full(chats.today))} />
        <Stat label={L.shared} value={full(chats.shared)} note={share(chats.shared, chats.total)} />
        <Stat label={L.anonymous} value={full(chats.anonymous)} note={share(chats.anonymous, chats.total)} />
      </dl>

      <section className={`${card} mt-3`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[13.5px] font-semibold text-gray-900">{L.daily}</h3>
          <div className="flex flex-wrap gap-2">
            <Segmented label={L.metric} options={L.metrics} value={metric} onChange={setMetric} />
            <Segmented
              label={L.period}
              options={L.periods}
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
            title: `${dayLabel(day.day)}, ${metric === 'chats' ? L.barChats(full(day.chats)) : L.barSignups(full(day.signups))}`,
            value: day[metric],
          }))}
          label={L.chart(metric)}
          first={dayLabel(daily[0].day)}
          last={dayLabel(daily[daily.length - 1].day)}
        />
      </section>

      <h2 className={`${sectionTitle} mt-8`}>{L.topRepos}</h2>
      {topRepos.length === 0 ? (
        <Empty>{L.noRepos}</Empty>
      ) : (
        <ol className={`${card} mt-3 space-y-3`}>
          {topRepos.map((repo, index) => (
            <li key={repo.repoName} className="flex items-center gap-3 text-[13px]">
              <span className="w-5 shrink-0 text-right text-gray-400 tabular-nums">{index + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-gray-900">{repo.repoName}</span>
                <span className="mt-1.5 block h-1 rounded-full bg-gray-100">
                  <span className="block h-1 origin-left animate-grow rounded-full bg-brand" style={{ width: `${(repo.chats / topCount) * 100}%` }} />
                </span>
              </span>
              <span className="w-12 shrink-0 text-right text-gray-700 tabular-nums">{L.times(full(repo.chats))}</span>
            </li>
          ))}
        </ol>
      )}
    </>
  )
}
