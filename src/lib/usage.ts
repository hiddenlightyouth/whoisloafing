import { useSyncExternalStore } from 'react'
import { authFetch } from './auth'
import { readItem, writeItem } from './storage'

// 요금제와 주간 사용량, 분석에 쓸 모델을 다뤄요. 한도와 기록은 서버가 지키고, 화면은 고른 모델을 요청에 실어 보내고 사용량을 보여줘요.

/** 사용량을 쓰는 작업. 서버의 UsageAction과 같은 이름이에요. */
export type UsageAction = 'intro' | 'contribution' | 'followup' | 'deep' | 'portfolio' | 'portfolio_revise' | 'resume' | 'resume_revise'

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
}

/** 고를 수 있는 모델. 지금은 Claude Haiku만 쓸 수 있고 나머지는 준비 중이에요. 서버가 알려 주는 값이 있으면 그것을 따라요. */
export const MODELS: ModelInfo[] = [
  { id: 'claude-haiku', provider: 'claude', name: 'Haiku 5.5', available: true },
  { id: 'claude-sonnet', provider: 'claude', name: 'Sonnet 5.5', available: false },
  { id: 'claude-opus', provider: 'claude', name: 'Opus 5.5', available: false },
  { id: 'gpt', provider: 'gpt', name: 'GPT-5', available: false },
  { id: 'gpt-mini', provider: 'gpt', name: 'GPT-5 mini', available: false },
  { id: 'gemini-pro', provider: 'gemini', name: 'Gemini Pro', available: false },
  { id: 'gemini-flash', provider: 'gemini', name: 'Gemini Flash', available: false },
]

export const providerOf = (model: ModelInfo) => PROVIDERS.find((provider) => provider.id === model.provider) ?? PROVIDERS[0]

/** 서버가 예전 버전이라 값을 주지 않을 때 쓰는 작업별 사용량. 서버의 UsageAction과 같아요. */
const FALLBACK_COSTS: Record<UsageAction, number> = {
  intro: 2,
  contribution: 10,
  followup: 2,
  deep: 4,
  portfolio: 12,
  portfolio_revise: 2,
  resume: 8,
  resume_revise: 2,
}

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
  costs: Record<string, number>
  models: { id: string; provider: string; name: string; available: boolean }[]
  plans: PlanInfo[]
}

let usage: Usage | null = null
let loading: Promise<Usage | null> | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** 이번 주 사용량을 새로 받아요. 서버에 사용량 API가 없거나 받지 못하면 null이에요. */
export function refreshUsage(): Promise<Usage | null> {
  loading ??= authFetch<Usage>('/usage')
    .then((result) => (result.ok && result.data ? result.data : null))
    .catch(() => null)
    .then((next) => {
      usage = next
      loading = null
      emit()
      return next
    })
  return loading
}

/** 받아 둔 이번 주 사용량. 아직 받지 않았으면 null이에요. */
export function useUsage(): Usage | null {
  return useSyncExternalStore(subscribe, () => usage, () => null)
}

export function costOf(action: UsageAction, current: Usage | null = usage): number {
  return current?.costs[action] ?? FALLBACK_COSTS[action]
}

/** 한도에 대한 비율(%). 0보다 크면 적어도 1%로 보여줘요. */
export function percentOf(units: number, limit: number): number {
  if (limit <= 0) return 100
  const percent = Math.ceil((units / limit) * 100)
  return Math.min(100, units > 0 ? Math.max(1, percent) : 0)
}

/** 서버가 알려 준 모델 사용 여부를 반영한 목록 */
export function modelsOf(current: Usage | null): ModelInfo[] {
  if (!current?.models.length) return MODELS
  return MODELS.map((model) => {
    const server = current.models.find((item) => item.id === model.id)
    return server ? { ...model, available: server.available } : model
  })
}

const MODEL_KEY = 'whoisloafing:model'

/** 마지막으로 고른 모델. 고른 모델을 쓸 수 없게 되었으면 Claude Haiku예요. */
export function getModel(): ModelId {
  const saved = readItem(MODEL_KEY)
  return MODELS.find((model) => model.id === saved && model.available)?.id ?? 'claude-haiku'
}

const modelListeners = new Set<() => void>()

export function setModel(model: ModelId) {
  writeItem(MODEL_KEY, model)
  for (const listener of modelListeners) listener()
}

/** 고른 모델. 여러 곳의 모델 메뉴가 같은 값을 보여줘요. */
export function useModel(): ModelId {
  return useSyncExternalStore(
    (listener) => {
      modelListeners.add(listener)
      return () => modelListeners.delete(listener)
    },
    getModel,
    () => 'claude-haiku' as ModelId,
  )
}

let plansOpener: (() => void) | null = null

/** 요금제 화면을 여는 함수를 등록해요. 화면을 고르는 App이 한 번 등록해요. */
export function setPlansOpener(open: (() => void) | null) {
  plansOpener = open
}

/** 요금제와 사용량 화면을 열어요. 말풍선의 버튼이나 모델 메뉴처럼 화면을 직접 옮기지 못하는 곳에서 써요. */
export function openPlans() {
  plansOpener?.()
}
