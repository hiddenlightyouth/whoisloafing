import { useEffect, useRef, useSyncExternalStore } from 'react'

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

function readPinned(): boolean {
  try {
    return localStorage.getItem(PINNED_KEY) === '1'
  } catch {
    return false
  }
}

/** held는 Option을 누르고 있는지, pinned는 설정에서 늘 보이게 켜 뒀는지예요. */
let hints = { held: false, pinned: typeof window !== 'undefined' && readPinned() }
const hintListeners = new Set<() => void>()

function setHints(next: Partial<typeof hints>) {
  const merged = { ...hints, ...next }
  if (merged.held === hints.held && merged.pinned === hints.pinned) return
  hints = merged
  hintListeners.forEach((listener) => listener())
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

const subscribeHints = (listener: () => void) => {
  hintListeners.add(listener)
  return () => hintListeners.delete(listener)
}

/** 버튼 옆에 단축키를 보여줄지예요. Option(Alt)을 누르고 있는 동안이나, 설정에서 단축키 힌트 표시를 켜 뒀을 때 true예요. */
export function useShortcutHints(): boolean {
  return useSyncExternalStore(
    subscribeHints,
    () => hints.held || hints.pinned,
    () => false,
  )
}

/** 설정의 단축키 힌트 표시가 켜져 있는지예요. */
export function useShortcutHintsPinned(): boolean {
  return useSyncExternalStore(
    subscribeHints,
    () => hints.pinned,
    () => false,
  )
}

/** 단축키 힌트를 늘 보이게 할지 정하고, 다음에 열었을 때도 그대로 두게 저장해요. */
export function setShortcutHintsPinned(pinned: boolean) {
  setHints({ pinned })
  try {
    if (pinned) localStorage.setItem(PINNED_KEY, '1')
    else localStorage.removeItem(PINNED_KEY)
  } catch {
    return
  }
}

const HELP_EVENT = 'whoisloafing:shortcut-help'

/** 단축키 안내 창을 열어요. 메뉴처럼 창을 직접 갖고 있지 않은 곳에서 불러요. */
export function openShortcutHelp() {
  window.dispatchEvent(new Event(HELP_EVENT))
}

export function onShortcutHelp(open: () => void): () => void {
  window.addEventListener(HELP_EVENT, open)
  return () => window.removeEventListener(HELP_EVENT, open)
}

export interface ShortcutGroup {
  title: string
  /** 앱에서만 쓰는 단축키 묶음이면 true */
  app?: boolean
  items: { keys: string[]; label: string; app?: boolean }[]
}

/** 단축키 안내 창에 보여주는 목록이에요. 단축키를 더하거나 바꾸면 여기도 같이 고쳐요. */
export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: '어디서나',
    items: [
      { keys: ['N'], label: '새 분석 시작하기' },
      { keys: ['/'], label: '링크 입력창으로 가기' },
      { keys: ['A'], label: '아티클 보기' },
      { keys: ['D'], label: '심층 분석 열기', app: true },
      { keys: ['B'], label: '사이드바 접기, 펴기', app: true },
      { keys: ['?'], label: '단축키 보기' },
    ],
  },
  {
    title: '심층 분석',
    app: true,
    items: [
      { keys: ['1', '2', '3', '4'], label: '탭 바꾸기' },
      { keys: ['R'], label: '재분석 요청' },
      { keys: ['C'], label: '채팅 열기, 닫기' },
      { keys: ['Esc'], label: '레포 고르는 화면으로 돌아가기' },
    ],
  },
  {
    title: '프로젝트 구조 맵',
    app: true,
    items: [
      { keys: ['+', '-'], label: '확대, 축소' },
      { keys: ['0'], label: '한눈에 보기' },
      { keys: ['M'], label: '주요 폴더만 펼치기' },
      { keys: ['S'], label: '소스 폴더만 펼치기' },
      { keys: ['E'], label: '모두 펼치기' },
      { keys: ['W'], label: '모두 접기' },
      { keys: ['H'], label: '폴더 설명 켜기, 끄기' },
    ],
  },
]
