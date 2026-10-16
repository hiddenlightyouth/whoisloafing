import { useEffect } from 'react'
import { messages, useLang, useMessages } from '../lib/i18n'
import { costOf, modelsOf, percentOf, PROVIDERS, refreshUsage, useUsage, type PlanId, type PlanInfo, type UsageAction } from '../lib/usage'
import { Bone } from './Skeleton'
import { formatReset, RESET_TEXT, UsageBar } from './ModelMenu'

/** 화면을 서버보다 먼저 배포했을 때 보여줄 요금제. 서버의 UsagePolicy와 같아요. */
const FALLBACK_PLANS: PlanInfo[] = [
  { id: 'FREE', weeklyLimit: 100, monthlyPrice: 0 },
  { id: 'LITE', weeklyLimit: 500, monthlyPrice: 5900 },
  { id: 'PRO', weeklyLimit: 1500, monthlyPrice: 14900 },
]

/** 레포 하나를 끝까지 분석할 때 쓰는 양. 레포 소개, 기여도 분석, 추가 질문 세 번이에요. */
const FULL_ANALYSIS: UsageAction[] = ['intro', 'contribution', 'followup', 'followup', 'followup']

const ACTIONS: UsageAction[] = ['intro', 'contribution', 'followup', 'deep', 'portfolio', 'portfolio_revise', 'resume', 'resume_revise']

const TEXT = messages({
  ko: {
    title: '요금제',
    intro: '분석할 때마다 이번 주 사용량을 조금씩 써요. 사용량은 매주 월요일 0시에 다시 채워져요.',
    usage: '이번 주 사용량',
    guest: '비회원',
    used: (percent: number) => `${percent}% 사용`,
    guestNote: '로그인하지 않으면 비회원 한도를 써요. 로그인하면 Free 요금제로 더 많이 쓸 수 있어요.',
    names: { FREE: 'Free', LITE: 'Lite', PRO: 'Pro' } as Record<PlanId, string>,
    blurbs: {
      FREE: '처음 써 보는 분께 맞아요.',
      LITE: '팀 프로젝트를 꾸준히 살펴보는 분께 맞아요.',
      PRO: '여러 레포로 포트폴리오와 이력서를 만드는 분께 맞아요.',
    } as Record<PlanId, string>,
    free: '무료',
    perMonth: '/월',
    times: (times: number) => `Free의 ${times}배 사용량`,
    base: '기본 사용량',
    analyses: (count: number) => `일주일에 레포 분석 약 ${count}번`,
    everything: '심층 분석, 포트폴리오, 이력서 모두 사용',
    current: '지금 쓰는 요금제',
    soon: '결제 준비 중',
    models: '모델',
    modelsNote: '분석을 시작할 때 입력창의 모델 메뉴에서 골라요. 지금은 Claude Haiku만 쓸 수 있어요.',
    soonModel: '준비 중',
    ready: '사용 가능',
    costs: '작업마다 쓰는 양',
    costsNote: '지금 요금제의 주간 사용량에 대한 비율이에요.',
    percent: (percent: number) => `약 ${percent}%`,
    actions: {
      intro: '레포 소개',
      contribution: '기여도 분석',
      followup: '추가 질문',
      deep: '심층 분석 탭 하나',
      portfolio: '포트폴리오 만들기',
      portfolio_revise: '포트폴리오 항목 다듬기',
      resume: '이력서에 프로젝트 추가',
      resume_revise: '이력서 경험 다듬기',
    } as Record<UsageAction, string>,
  },
  en: {
    title: 'Plans',
    intro: 'Each analysis uses a little of your weekly usage. It refills every Monday at midnight (KST).',
    usage: 'Usage this week',
    guest: 'Guest',
    used: (percent: number) => `${percent}% used`,
    guestNote: "Without signing in you're on the guest limit. Sign in to get more with the Free plan.",
    names: { FREE: 'Free', LITE: 'Lite', PRO: 'Pro' } as Record<PlanId, string>,
    blurbs: {
      FREE: 'For trying it out.',
      LITE: 'For keeping up with team projects.',
      PRO: 'For building portfolios and resumes from many repos.',
    } as Record<PlanId, string>,
    free: 'Free',
    perMonth: '/mo',
    times: (times: number) => `${times}x the usage of Free`,
    base: 'Base usage',
    analyses: (count: number) => `About ${count} repo analyses a week`,
    everything: 'Deep dive, portfolio, and resume included',
    current: 'Current plan',
    soon: 'Checkout coming soon',
    models: 'Models',
    modelsNote: 'Pick a model from the model menu when you start an analysis. Only Claude Haiku is available for now.',
    soonModel: 'Coming soon',
    ready: 'Available',
    costs: 'Usage per task',
    costsNote: "Shown as a share of your current plan's weekly usage.",
    percent: (percent: number) => `About ${percent}%`,
    actions: {
      intro: 'Repo introduction',
      contribution: 'Contribution analysis',
      followup: 'Follow-up question',
      deep: 'One deep dive tab',
      portfolio: 'Create a portfolio',
      portfolio_revise: 'Polish a portfolio section',
      resume: 'Add a project to your resume',
      resume_revise: 'Polish a resume experience',
    } as Record<UsageAction, string>,
  },
})

/** 요금제와 이번 주 사용량, 쓸 수 있는 모델, 작업마다 쓰는 양을 보여줘요. 앱 화면(/plans)에서 열어요. */
export function Plans() {
  const L = useMessages(TEXT)
  const R = useMessages(RESET_TEXT)
  const lang = useLang()
  const usage = useUsage()

  useEffect(() => {
    void refreshUsage()
  }, [])

  const plans = usage?.plans.length ? usage.plans : FALLBACK_PLANS
  const base = plans.find((plan) => plan.id === 'FREE')?.weeklyLimit ?? FALLBACK_PLANS[0].weeklyLimit
  const perAnalysis = FULL_ANALYSIS.reduce((sum, action) => sum + costOf(action, usage), 0)
  const price = (won: number) => new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'ko-KR', { style: 'currency', currency: 'KRW' }).format(won)

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-5 pt-20 pb-20 sm:pt-24">
        <h1 className="text-[24px] leading-snug font-semibold text-gray-900 sm:text-[30px]">{L.title}</h1>
        <p className="mt-2 text-[14px] leading-relaxed break-keep text-gray-500">{L.intro}</p>

        <section className="mt-8 rounded-2xl border border-gray-200 p-5">
          {usage ? (
            <>
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <p className="text-[14px] font-semibold text-gray-900">
                  {L.usage}
                  <span className="ml-2 font-medium text-gray-400">{usage.plan ? L.names[usage.plan] : L.guest}</span>
                </p>
                <p className="text-[13px] text-gray-500 tabular-nums">{L.used(percentOf(usage.used, usage.limit))}</p>
              </div>
              <UsageBar usage={usage} />
              <p className="mt-3 text-[13px] text-gray-500">{R.reset(formatReset(usage.resetAt, lang))}</p>
              {usage.guest && <p className="mt-1 text-[13px] break-keep text-gray-500">{L.guestNote}</p>}
            </>
          ) : (
            <>
              <Bone className="h-4 w-32" />
              <Bone className="mt-4 h-2 w-full" />
              <Bone className="mt-4 h-3.5 w-48" />
            </>
          )}
        </section>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {plans.map((plan, index) => {
            const current = usage?.plan === plan.id
            const times = Math.round(plan.weeklyLimit / base)
            return (
              <section
                key={plan.id}
                style={{ animationDelay: `${index * 60}ms` }}
                className={`flex animate-rise flex-col rounded-2xl border p-5 ${current ? 'border-brand' : 'border-gray-200'}`}
              >
                <h2 className="text-[16px] font-semibold text-gray-900">{L.names[plan.id]}</h2>
                <p className="mt-1 text-[13px] leading-relaxed break-keep text-gray-500">{L.blurbs[plan.id]}</p>
                <p className="mt-4 text-[26px] leading-none font-semibold text-gray-900 tabular-nums">
                  {plan.monthlyPrice === 0 ? L.free : price(plan.monthlyPrice)}
                  {plan.monthlyPrice > 0 && <span className="ml-1 text-[13px] font-medium text-gray-400">{L.perMonth}</span>}
                </p>
                <ul className="mt-5 flex-1 space-y-2 text-[13px] text-gray-700">
                  {[times > 1 ? L.times(times) : L.base, L.analyses(Math.max(1, Math.floor(plan.weeklyLimit / perAnalysis))), L.everything].map((line) => (
                    <li key={line} className="flex gap-2">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-0.5 size-3.5 shrink-0 text-brand" aria-hidden>
                        <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {line}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled
                  className={`mt-6 h-10 rounded-full text-[13px] font-semibold ${current ? 'bg-brand-soft text-brand' : 'bg-gray-100 text-gray-400'}`}
                >
                  {current ? L.current : plan.id === 'FREE' ? L.base : L.soon}
                </button>
              </section>
            )
          })}
        </div>

        <div className="mt-12 grid gap-10 md:grid-cols-2">
          <section>
            <h2 className="text-[15px] font-semibold text-gray-900">{L.models}</h2>
            <p className="mt-1 text-[13px] break-keep text-gray-500">{L.modelsNote}</p>
            <ul className="mt-4 divide-y divide-gray-100 border-y border-gray-100">
              {PROVIDERS.map((provider) => (
                <li key={provider.id} className="flex items-start gap-3 py-3">
                  <img src={provider.logo} alt="" className="mt-0.5 size-6 rounded-md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-gray-900">{provider.name}</p>
                    <ul className="mt-1.5 space-y-1">
                      {modelsOf(usage)
                        .filter((model) => model.provider === provider.id)
                        .map((model) => (
                          <li key={model.id} className="flex items-center justify-between gap-3 text-[13px]">
                            <span className={model.available ? 'text-gray-700' : 'text-gray-400'}>{model.name}</span>
                            <span className={model.available ? 'text-brand' : 'text-gray-400'}>{model.available ? L.ready : L.soonModel}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-gray-900">{L.costs}</h2>
            <p className="mt-1 text-[13px] break-keep text-gray-500">{L.costsNote}</p>
            <dl className="mt-4 divide-y divide-gray-100 border-y border-gray-100 text-[14px]">
              {ACTIONS.map((action) => (
                <div key={action} className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-gray-600">{L.actions[action]}</dt>
                  <dd className="font-medium text-gray-900 tabular-nums">
                    {usage ? L.percent(percentOf(costOf(action, usage), usage.limit)) : <Bone className="h-4 w-12" />}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </main>
  )
}
