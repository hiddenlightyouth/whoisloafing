import { useSyncExternalStore } from 'react'

export interface ToastMessage {
  id: number
  text: string
}

const SHOW_MS = 2400

let current: ToastMessage | null = null
let nextId = 1
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

/** 화면 아래에 짧은 안내를 잠깐 띄워요. 새 안내가 오면 앞의 것을 바로 바꿔요. */
export function showToast(text: string) {
  current = { id: nextId++, text }
  clearTimeout(timer)
  timer = setTimeout(() => {
    current = null
    emit()
  }, SHOW_MS)
  emit()
}

export function useToast(): ToastMessage | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current,
    () => null,
  )
}
