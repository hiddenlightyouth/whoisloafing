import { track } from './analytics'
import { authFetch } from './auth'
import { readItem, writeItem } from './storage'
import { createStore, useStore } from './store'

// 요금제와 주간 사용량, 분석에 쓸 모델을 다뤄요. 한도와 기록은 서버가 지키고, 화면은 고른 모델을 요청에 실어 보내고 사용량을 보여줘요.

export type PlanId = 'FREE' | 'LITE' | 'PRO'

export type ProviderId = 'claude' | 'gpt' | 'gemini'

export type ModelId = 'claude-haiku' | 'claude-sonnet' | 'claude-opus' | 'gpt' | 'gpt-mini' | 'gemini-pro' | 'gemini-flash'

export interface Provider {
  id: ProviderId
  name: string
  logo: string
}

/** 모델을 만든 회사. 모델 메뉴에서 회사마다 묶어서 보여줘요. */
export const PROVIDERS: Provider[] = [
  { id: 'claude', name: 'Claude', logo: '/models/claude.svg' },
  { id: 'gpt', name: 'GPT', logo: '/models/gpt.svg' },
  { id: 'gemini', name: 'Gemini', logo: '/models/gemini.svg' },
]

export interface ModelInfo {
  id: ModelId
  provider: ProviderId
  name: string
  available: boolean
  /** 주간 사용량 배수. 같은 토큰을 써도 비싼 모델일수록 이만큼 더 깎여요. */
  multiplier: number
}

/** 고를 수 있는 모델. 지금은 Claude Haiku만 쓸 수 있고 나머지는 준비 중이에요. 서버가 알려 주는 값이 있으면 그것을 따라요. */
export const MODELS: ModelInfo[] = [
  { id: 'claude-haiku', provider: 'claude', name: 'Haiku 5.5', available: true, multiplier: 1 },
  { id: 'claude-sonnet', provider: 'claude', name: 'Sonnet 5.5', available: false, multiplier: 3 },
  { id: 'claude-opus', provider: 'claude', name: 'Opus 5.5', available: false, multiplier: 5 },
  { id: 'gpt', provider: 'gpt', name: 'GPT-5', available: false, multiplier: 4 },
  { id: 'gpt-mini', provider: 'gpt', name: 'GPT-5 mini', available: false, multiplier: 1 },
  { id: 'gemini-pro', provider: 'gemini', name: 'Gemini Pro', available: false, multiplier: 3 },
  { id: 'gemini-flash', provider: 'gemini', name: 'Gemini Flash', available: false, multiplier: 1 },
]

export const providerOf = (model: ModelInfo) => PROVIDERS.find((provider) => provider.id === model.provider) ?? PROVIDERS[0]

export interface PlanInfo {
  id: PlanId
  weeklyLimit: number
  /** 한 달 요금(원) */
  monthlyPrice: number
}

export interface Usage {
  /** 로그인하지 않았으면 null이에요. */
  plan: PlanId | null
  guest: boolean
  limit: number
  used: number
  /** 다시 채워지는 때. 한국 시간 월요일 0시예요. */
  resetAt: string
  models: { id: string; provider: string; name: string; available: boolean; multiplier?: number }[]
  plans: PlanInfo[]
}

const usage = createStore<Usage | null>(null)
let loading: Promise<Usage | null> | null = null

/** 이번 주 사용량을 새로 받아요. 서버에 사용량 API가 없거나 받지 못하면 null이에요. */
export function refreshUsage(): Promise<Usage | null> {
  loading ??= authFetch<Usage>('/usage')
    .then((result) => (result.ok && result.data ? result.data : null))
    .catch(() => null)
    .then((next) => {
      loading = null
      usage.set(next)
      return next
    })
  return loading
}

/** 받아 둔 이번 주 사용량. 아직 받지 않았으면 null이에요. */
export function useUsage(): Usage | null {
  return useStore(usage, undefined, null)
}

/** 한도에 대한 비율(%). 0보다 크면 적어도 1%로 보여줘요. */
export function percentOf(units: number, limit: number): number {
  if (limit <= 0) return 100
  const percent = Math.ceil((units / limit) * 100)
  return Math.min(100, units > 0 ? Math.max(1, percent) : 0)
}

/** 서버가 알려 준 모델 사용 여부와 배수를 반영한 목록 */
export function modelsOf(current: Usage | null): ModelInfo[] {
  if (!current?.models.length) return MODELS
  return MODELS.map((model) => {
    const server = current.models.find((item) => item.id === model.id)
    return server ? { ...model, available: server.available, multiplier: server.multiplier ?? model.multiplier } : model
  })
}

const MODEL_KEY = 'whoisloafing:model'

/** 마지막으로 고른 모델. 고른 모델을 쓸 수 없게 되었으면 Claude Haiku예요. */
function readModel(): ModelId {
  const saved = readItem(MODEL_KEY)
  return MODELS.find((model) => model.id === saved && model.available)?.id ?? 'claude-haiku'
}

const model = createStore<ModelId>(typeof window === 'undefined' ? 'claude-haiku' : readModel())

export const getModel = model.get

export function setModel(next: ModelId) {
  writeItem(MODEL_KEY, next)
  model.set(next)
}

/** 고른 모델. 여러 곳의 모델 메뉴가 같은 값을 보여줘요. */
export function useModel(): ModelId {
  return useStore(model, undefined, 'claude-haiku')
}

const plansOpen = createStore(false)
const setPlansOpen = plansOpen.set

/** 요금제 창을 열어요. 계정 메뉴, 모델 메뉴, 말풍선 어디서든 같은 창이 떠요. */
export function openPlans(from: 'menu' | 'model' | 'chat') {
  track('plans_open', { from })
  setPlansOpen(true)
}

export function closePlans() {
  setPlansOpen(false)
}

/** 요금제 창이 열려 있는지. App이 한 번 읽어서 창을 그려요. */
export function usePlansOpen(): boolean {
  return useStore(plansOpen)
}
