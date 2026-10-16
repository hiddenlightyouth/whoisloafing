import { useEffect, useRef, useState } from 'react'
import { useDismiss } from '../hooks/useDismiss'
import { track } from '../lib/analytics'
import { messages, useMessages } from '../lib/i18n'
import { modelsOf, PROVIDERS, providerOf, refreshUsage, setModel, useModel, useUsage } from '../lib/usage'

const TEXT = messages({
  ko: {
    model: '모델 고르기',
    soon: '준비 중',
    multiplier: (times: number) => `사용량 ${times}배`,
  },
  en: {
    model: 'Choose a model',
    soon: 'Coming soon',
    multiplier: (times: number) => `${times}x usage`,
  },
})

/**
 * 분석에 쓸 모델을 고르는 작은 메뉴예요. 다른 AI 서비스처럼 입력창이나 만들기 버튼 옆에 두고, 누르면 모델 목록이 펼쳐져요. 사용량은 사이드바의 계정 메뉴에서 봐요.
 * 모델은 회사(Claude, GPT, Gemini)마다 묶어서 보여주고, 이름 옆에 사용량 배수를 적어요. 지금은 Claude Haiku만 고를 수 있고 나머지는 준비 중으로 흐리게 둬요. 고른 모델은 저장돼서 분석 요청에 같이 실려요.
 */
export function ModelMenu({ up = false, className = '' }: { /** 위로 펼쳐요. 화면 아래쪽 줄에 둘 때 켜요. */ up?: boolean; className?: string }) {
  const L = useMessages(TEXT)
  const usage = useUsage()
  const model = useModel()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(open, ref, () => setOpen(false))

  // 모델마다 쓸 수 있는지 서버의 /usage가 알려 줘서, 열 때마다 새로 받아요.
  useEffect(() => {
    if (open) void refreshUsage()
  }, [open])

  const models = modelsOf(usage)
  const current = models.find((item) => item.id === model) ?? models[0]

  return (
    <div ref={ref} className={`relative shrink-0 ${className}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={L.model}
        onClick={() => setOpen((value) => !value)}
        className={`flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium transition-colors ${open ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
      >
        <img src={providerOf(current).logo} alt="" className="size-4 rounded" />
        <span className="hidden sm:inline">{providerOf(current).name}</span>
        <span>{current.name}</span>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-3 text-gray-400" aria-hidden>
          <path d="M4.5 6.5L8 10l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label={L.model}
          className={`absolute right-0 z-30 w-64 animate-pop rounded-2xl border border-gray-200 bg-white p-1.5 text-left ${
            up ? 'bottom-full mb-2 origin-bottom-right' : 'top-full mt-2 origin-top-right'
          }`}
        >
          <div className="max-h-[min(360px,50vh)] overflow-y-auto">
            {/* 회사마다 묶어서, 이름 아래에 그 회사의 모델을 늘어놓아요. */}
            {PROVIDERS.map((provider) => (
              <div key={provider.id} role="group" aria-label={provider.name} className="py-1">
                <p className="flex items-center gap-2 px-2.5 pt-1 pb-1.5 text-[12px] font-medium text-gray-500">
                  <img src={provider.logo} alt="" className="size-4 rounded" />
                  {provider.name}
                </p>
                {models
                  .filter((item) => item.provider === provider.id)
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={item.id === model}
                      disabled={!item.available}
                      onClick={() => {
                        setModel(item.id)
                        track('model_select', { model: item.id })
                        setOpen(false)
                      }}
                      className="flex h-9 w-full items-center gap-2 rounded-xl pr-2.5 pl-8 text-left text-[13px] transition-colors enabled:hover:bg-gray-50 disabled:cursor-not-allowed"
                    >
                      <span className={`min-w-0 flex-1 truncate font-medium ${item.available ? 'text-gray-900' : 'text-gray-400'}`}>{item.name}</span>
                      <span className="shrink-0 text-[11.5px] text-gray-400 tabular-nums" aria-label={L.multiplier(item.multiplier)}>
                        ×{item.multiplier}
                      </span>
                      {item.id === model ? (
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4 text-brand" aria-hidden>
                          <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        !item.available && <span className="shrink-0 text-[11.5px] text-gray-400">{L.soon}</span>
                      )}
                    </button>
                  ))}
              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  )
}
