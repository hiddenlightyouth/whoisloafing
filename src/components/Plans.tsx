import { useEffect } from 'react'
import { messages, useLang, useMessages } from '../lib/i18n'
import { refreshUsage, useUsage, type PlanId, type PlanInfo } from '../lib/usage'
import { Modal } from './Dialog'
import { CheckIcon, CloseButton } from './Icons'

/** 화면을 서버보다 먼저 배포했을 때 보여줄 요금제. 서버의 UsagePolicy와 같아요. */
const FALLBACK_PLANS: PlanInfo[] = [
  { id: 'FREE', weeklyLimit: 100, monthlyPrice: 0 },
  { id: 'LITE', weeklyLimit: 500, monthlyPrice: 5900 },
  { id: 'PRO', weeklyLimit: 1500, monthlyPrice: 14900 },
]

const TEXT = messages({
  ko: {
    title: '업그레이드',
    close: '닫기',
    names: { FREE: 'Free', LITE: 'Lite', PRO: 'Pro' } as Record<PlanId, string>,
    blurbs: {
      LITE: '프로젝트 관리자에게 적합',
      PRO: '여러 프로젝트를 관리하고, 이력서와 포트폴리오 제작',
    } as Partial<Record<PlanId, string>>,
    free: '무료',
    perMonth: '/월',
    times: (than: string, times: number) => `${than}의 ${times}배 사용량`,
    base: '기본 사용량',
    features: ['심층 분석', '포트폴리오', '이력서'],
    current: '사용 중',
    soon: '변경할 수 없음',
  },
  en: {
    title: 'Upgrade',
    close: 'Close',
    names: { FREE: 'Free', LITE: 'Lite', PRO: 'Pro' } as Record<PlanId, string>,
    blurbs: {
      LITE: 'For project managers',
      PRO: 'Manage many projects and build resumes and portfolios',
    } as Partial<Record<PlanId, string>>,
    free: 'Free',
    perMonth: '/mo',
    times: (than: string, times: number) => `${times}x the usage of ${than}`,
    base: 'Base usage',
    features: ['Deep dive', 'Portfolio', 'Resume'],
    current: 'In use',
    soon: 'Unavailable',
  },
})

/** 요금제 세 개만 보여주는 창이에요. 계정 메뉴, 모델 메뉴, 말풍선의 플랜 변경 버튼으로 열어요. */
export function PlansModal({ onClose }: { onClose: () => void }) {
  const L = useMessages(TEXT)
  const lang = useLang()
  const usage = useUsage()

  useEffect(() => {
    void refreshUsage()
  }, [])

  const plans = usage?.plans.length ? usage.plans : FALLBACK_PLANS
  const price = (won: number) => new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'ko-KR', { style: 'currency', currency: 'KRW' }).format(won)

  return (
    <Modal onClose={onClose} labelledBy="plans-title" className="max-h-[calc(100dvh-40px)] w-full max-w-3xl overflow-y-auto p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 id="plans-title" className="text-[18px] font-semibold text-gray-900">
          {L.title}
        </h2>
        <CloseButton label={L.close} onClick={onClose} size="md" />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {plans.map((plan, index) => {
          const current = usage?.plan === plan.id
          // 사용량은 바로 아래 요금제와 견줘서 적어요. Pro는 Free가 아니라 Lite의 몇 배인지예요.
          const below = plans[index - 1]
          const times = below ? Math.round(plan.weeklyLimit / below.weeklyLimit) : 1
          const blurb = L.blurbs[plan.id]
          return (
            <section
              key={plan.id}
              style={{ animationDelay: `${index * 60}ms` }}
              className={`flex animate-rise flex-col rounded-2xl border p-5 ${current ? 'border-brand' : 'border-gray-200'}`}
            >
              <h3 className="text-[16px] font-semibold text-gray-900">{L.names[plan.id]}</h3>
              {/* 설명이 없거나 짧아도 두 줄 자리를 잡아서, 세 카드의 값이 같은 높이에 와요. */}
              <p className="mt-1 text-[13px] leading-relaxed break-keep text-gray-500 md:min-h-[42px]">{blurb}</p>
              <p className="mt-4 text-[26px] leading-none font-semibold text-gray-900 tabular-nums">
                {plan.monthlyPrice === 0 ? L.free : price(plan.monthlyPrice)}
                {plan.monthlyPrice > 0 && <span className="ml-1 text-[13px] font-medium text-gray-400">{L.perMonth}</span>}
              </p>
              <ul className="mt-5 flex-1 space-y-2 text-[13px] text-gray-700">
                {[below && times > 1 ? L.times(L.names[below.id], times) : L.base, ...L.features].map((line) => (
                  <li key={line} className="flex gap-2">
                    <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-brand" />
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
