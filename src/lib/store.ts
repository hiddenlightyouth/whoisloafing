import { useSyncExternalStore } from 'react'

// 화면 밖에 두는 작은 값이에요. 값이 바뀌면 이 값을 읽는 컴포넌트가 다시 그려져요.

export interface Store<T> {
  get: () => T
  set: (next: T) => void
  subscribe: (listener: () => void) => () => void
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set(next) {
      if (Object.is(next, value)) return
      value = next
      listeners.forEach((listener) => listener())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/**
 * 값을 읽어요. select로 일부만 골라 읽을 수 있어요.
 * server는 미리 그리는 화면과 처음 붙일 때 쓰는 값이라, 브라우저마다 다른 값(저장해 둔 설정 등)은 여기에 기본값을 줘요.
 */
export function useStore<T, S = T>(store: Store<T>, select: (value: T) => S = (value) => value as unknown as S, server?: S): S {
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.get()),
    () => (server === undefined ? select(store.get()) : server),
  )
}
