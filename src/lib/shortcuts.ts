import { useEffect, useRef } from 'react'
import { createStore, useStore } from './store'
import { readFlag, writeFlag } from './storage'

/**
 * 단축키는 글자가 아니라 키의 자리(`event.code`)로 알아봐요. 한글 자판 상태에서 N을 눌러도 ㅜ가 아니라 N으로 받아요.
 * Shift를 같이 누르는 키는 앞에 `Shift+`를 붙여요. (예: `Shift+Slash`는 물음표)
 */
export type ShortcutMap = Record<string, (() => void) | undefined>

const TYPING = 'input, textarea, select, [contenteditable="true"]'

/**
 * 화면에 단축키를 걸어요. 글자를 입력하는 중이거나, Command나 Ctrl을 누르고 있거나, 확인 창이 떠 있을 때는 받지 않아요.
 * 그래서 브라우저와 앱의 기본 단축키(Command R 등)와 겹치지 않아요. Option은 키를 보려고 누르고 있는 키라서, 누른 채로도 받아요.
 */
export function useShortcuts(keys: ShortcutMap, enabled = true) {
  const latest = useRef(keys)
  latest.current = keys

  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.isComposing || event.repeat) return
      const target = event.target as HTMLElement | null
      if (target?.closest(TYPING)) return
      if (document.querySelector('[aria-modal="true"]')) return
      // 물음표처럼 자판마다 자리가 다른 기호는 `Key:?`처럼 글자로도 걸 수 있어요.
      const action = latest.current[`${event.shiftKey ? 'Shift+' : ''}${event.code}`] ?? latest.current[`Key:${event.key}`]
      if (!action) return
      event.preventDefault()
      action()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}

const PINNED_KEY = 'whoisloafing:shortcut-hints'

const readPinned = () => readFlag(PINNED_KEY)

/** held는 Option을 누르고 있는지, pinned는 설정에서 늘 보이게 켜 뒀는지예요. */
const hints = createStore({ held: false, pinned: typeof window !== 'undefined' && readPinned() })

function setHints(next: Partial<ReturnType<typeof hints.get>>) {
  const current = hints.get()
  const merged = { ...current, ...next }
  if (merged.held !== current.held || merged.pinned !== current.pinned) hints.set(merged)
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Alt') setHints({ held: true })
  })
  window.addEventListener('keyup', (event) => {
    if (event.key === 'Alt') setHints({ held: false })
  })
  // 다른 창으로 넘어가면 키를 뗀 것을 알 수 없어서, 그때는 숨겨요.
  window.addEventListener('blur', () => setHints({ held: false }))
}

/** 버튼 옆에 단축키를 보여줄지예요. Option(Alt)을 누르고 있는 동안이나, 설정에서 단축키 힌트 표시를 켜 뒀을 때 true예요. */
export function useShortcutHints(): boolean {
  return useStore(hints, (value) => value.held || value.pinned, false)
}

/** 설정의 단축키 힌트 표시가 켜져 있는지예요. */
export function useShortcutHintsPinned(): boolean {
  return useStore(hints, (value) => value.pinned, false)
}

/** 단축키 힌트를 늘 보이게 할지 정하고, 다음에 열었을 때도 그대로 두게 저장해요. */
export function setShortcutHintsPinned(pinned: boolean) {
  setHints({ pinned })
  writeFlag(PINNED_KEY, pinned)
}
