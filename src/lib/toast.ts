import { createStore, useStore } from './store'

export interface ToastMessage {
  id: number
  text: string
}

const SHOW_MS = 2400
/** 긴 안내는 읽을 시간이 더 필요해서, 글자 수에 맞춰 더 오래 보여줘요. */
const MS_PER_CHAR = 80

const current = createStore<ToastMessage | null>(null)
let nextId = 1
let timer: ReturnType<typeof setTimeout> | undefined

/** 화면 아래에 짧은 안내를 잠깐 띄워요. 새 안내가 오면 앞의 것을 바로 바꿔요. */
export function showToast(text: string) {
  current.set({ id: nextId++, text })
  clearTimeout(timer)
  timer = setTimeout(() => current.set(null), Math.max(SHOW_MS, text.length * MS_PER_CHAR))
}

export function useToast(): ToastMessage | null {
  return useStore(current)
}
