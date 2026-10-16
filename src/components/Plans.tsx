import { useEffect } from 'react'
import { messages, useLang, useMessages } from '../lib/i18n'
import { costOf, refreshUsage, useModel, useUsage, type PlanId, type PlanInfo, type UsageAction } from '../lib/usage'
import { Modal } from './Dialog'

/** 화면을 서버보다 먼저 배포했을 때 보여줄 요금제. 서버의 UsagePolicy와 같아요. */
const FALLBACK_PLANS: PlanInfo[] = [
  { id: 'FREE', weeklyLimit: 100, monthlyPrice: 0 },
  { id: 'LITE', weeklyLimit: 500, monthlyPrice: 5900 },
  { id: 'PRO', weeklyLimit: 1500, monthlyPrice: 14900 },
]

/** 레포 하나를 끝까지 분석할 때 보통 쓰는 양. 레포 소개, 기여도 분석, 추가 질문 세 번이에요. */
const FULL_ANALYSIS: UsageAction[] = ['intro', 'contribution', 'followup', 'followup', 'followup']

const TEXT = messages({
  ko: {
    title: '플랜 변경',
    close: '닫기',
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
    current: '사용 중',
    soon: '결제 준비 중',
  },
  en: {
    title: 'Change plan',
    close: 'Close',
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
    current: 'In use',
    soon: 'Checkout coming soon',
  },
})

/** 요금제 세 개만 보여주는 창이에요. 계정 메뉴, 모델 메뉴, 말풍선의 플랜 변경 버튼으로 열어요. */
export function PlansModal({ onClose }: { onClose: () => void }) {
  const L = useMessages(TEXT)
  const lang = useLang()
  const usage = useUsage()
  const model = useModel()

  useEffect(() => {
    void refreshUsage()
  }, [])

  const plans = usage?.plans.length ? usage.plans : FALLBACK_PLANS
  const base = plans.find((plan) => plan.id === 'FREE')?.weeklyLimit ?? FALLBACK_PLANS[0].weeklyLimit
  const perAnalysis = FULL_ANALYSIS.reduce((sum, action) => sum + costOf(action, usage, model), 0)
  const price = (won: number) => new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'ko-KR', { style: 'currency', currency: 'KRW' }).format(won)

  return (
    <Modal onClose={onClose} labelledBy="plans-title" className="max-h-[calc(100dvh-40px)] w-full max-w-3xl overflow-y-auto p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 id="plans-title" className="text-[18px] font-semibold text-gray-900">
          {L.title}
        </h2>
        <button
          type="button"
          aria-label={L.close}
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="size-4" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {plans.map((plan, index) => {
          const current = usage?.plan === plan.id
          const times = Math.round(plan.weeklyLimit / base)
          return (
            <section
              key={plan.id}
              style={{ animationDelay: `${index * 60}ms` }}
              className={`flex animate-rise flex-col rounded-2xl border p-5 ${current ? 'border-brand' : 'border-gray-200'}`}
            >
              <h3 className="text-[16px] font-semibold text-gray-900">{L.names[plan.id]}</h3>
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
    </Modal>
  )
}
