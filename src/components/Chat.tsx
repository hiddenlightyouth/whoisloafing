import { useCallback, useEffect, useRef, useState } from 'react'
import type { AnalyzeRequest } from '../../shared/types'
import type { ChatMessage } from '../hooks/useAnalysis'
import { track } from '../lib/analytics'
import { Bubble } from './Bubble'
import { TypingDots } from './TypingDots'

interface Props {
  messages: ChatMessage[]
  busy: boolean
  /** 계속하기를 기다리는 중이면 다음 단계 안내 */
  paused: string | null
  /** 공유된 채팅처럼 읽기만 할 수 있는 상태 */
  readOnly: boolean
  onResume: () => void
  onHome: () => void
  onSend: (request: AnalyzeRequest, userText?: string) => void
}

/** 맨 아래에서 이만큼 안쪽이면 아래에 붙어 있는 것으로 봐요. */
const BOTTOM_THRESHOLD_PX = 80

// 지난 말풍선을 흐리게 하는 효과
const HEADER_HEIGHT_PX = 56
/** 화면 위에서부터 이 비율만큼의 구간에서 서서히 밝아져요. */
const FOCUS_FADE_RATIO = 0.4
const FOCUS_MIN_OPACITY = 0.3
/** 이만큼 스크롤되면 흐림 효과가 온전히 적용돼요. */
const FOCUS_RAMP_PX = 240

export function Chat({ messages, busy, paused, readOnly, onResume, onSend, onHome }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  const lastScrollTop = useRef(0)
  const [atBottom, setAtBottom] = useState(true)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior })
  }, [])

  // 사용자가 직접 위로 올렸을 때만 따라 내려가기를 멈춰요.
  // 긴 말풍선이 올라오는 동안 잠깐 바닥에서 멀어지는 것은 위로 올린 것으로 보지 않아요.
  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD_PX
    if (near) pinned.current = true
    else if (el.scrollTop < lastScrollTop.current - 2) pinned.current = false
    lastScrollTop.current = el.scrollTop
    setAtBottom(near || pinned.current)
    updateFocus()
  }

  // 화면 위쪽으로 밀려난 지난 말풍선은 흐리게 두고, 아래로 내려올수록 서서히 밝아지게 해요.
  const updateFocus = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const view = el.getBoundingClientRect()
    const fadeStart = view.top + HEADER_HEIGHT_PX
    const fadeRange = (view.height - HEADER_HEIGHT_PX) * FOCUS_FADE_RATIO
    // 위로 넘어간 내용이 없으면 흐리게 하지 않고, 스크롤된 만큼만 서서히 효과를 줘요.
    const strength = Math.min(1, el.scrollTop / FOCUS_RAMP_PX)
    for (const item of el.querySelectorAll<HTMLElement>('[data-focus]')) {
      const rect = item.getBoundingClientRect()
      // 화면에 보이는 부분의 가운데를 기준으로 해요. 화면보다 긴 말풍선도 자연스럽게 밝아져요.
      const visibleTop = Math.max(rect.top, fadeStart)
      const visibleBottom = Math.min(rect.bottom, view.bottom)
      const center = visibleBottom > visibleTop ? (visibleTop + visibleBottom) / 2 : rect.bottom
      const progress = Math.min(1, Math.max(0, (center - fadeStart) / fadeRange))
      item.style.opacity = String(1 - (1 - FOCUS_MIN_OPACITY) * (1 - progress) * strength)
    }
  }, [])

  useEffect(() => {
    updateFocus()
    window.addEventListener('resize', updateFocus)
    return () => window.removeEventListener('resize', updateFocus)
  }, [messages.length, busy, updateFocus])

  // 아래에 붙어 있을 때만 새 말풍선을 따라 내려가요. 위로 올려서 읽는 중이면 그대로 둬요.
  useEffect(() => {
    if (pinned.current) scrollToBottom()
  }, [messages.length, busy, paused, scrollToBottom])

  // 글이 타자를 치듯 늘어나면서 말풍선 높이가 바뀔 때도, 아래에 붙어 있었다면 따라 내려가요.
  const contentRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const content = contentRef.current
    if (!content) return
    const observer = new ResizeObserver(() => {
      if (pinned.current) scrollToBottom('auto')
      updateFocus()
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [scrollToBottom, updateFocus])

  return (
    <main className="relative flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 pt-14 sm:px-6">
        <div
          ref={contentRef}
          className="mx-auto flex max-w-2xl flex-col gap-2.5 pt-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]"
          aria-live="polite"
        >
          {messages.map((message, index) => (
            // 말풍선 자체에는 등장 애니메이션이 걸려 있어서, 밝기는 바깥 칸에서 따로 조절해요.
            <div key={message.id} data-focus className="transition-opacity duration-200 ease-out">
              <Bubble
                message={message}
                busy={busy || readOnly}
                isLast={index === messages.length - 1}
                onSend={onSend}
              />
            </div>
          ))}
          {/* 말풍선이 하나 올라올 때마다 새로 그려서, 오래 기다릴 때만 문구가 나오게 해요. */}
          {paused ? (
            <div className="mt-2 flex animate-rise flex-wrap items-center justify-end gap-x-3 gap-y-2">
              <p className="text-[13px] text-gray-500">
                다음 단계 <span className="ml-1 font-medium text-gray-900">{paused}</span>
              </p>
              <button
                type="button"
                autoFocus
                onClick={onResume}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand pr-3.5 pl-4 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover"
              >
                계속하기
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4" aria-hidden="true">
                  <path d="M8 3.5v9M4.5 9L8 12.5 11.5 9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          ) : (
            busy && <TypingDots key={messages.length} />
          )}
          {readOnly && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-soft px-4 py-3">
              <p className="text-[13px] text-gray-600">공유된 채팅이라 읽기만 할 수 있어요.</p>
              <button
                type="button"
                onClick={onHome}
                className="h-9 rounded-full bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover"
              >
                다른 레포 분석해 보기
              </button>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        aria-label="맨 아래로 이동"
        tabIndex={atBottom ? -1 : 0}
        onClick={() => {
          track('scroll_to_bottom_click')
          scrollToBottom()
        }}
        className={`absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition-all duration-200 hover:text-brand ${
          atBottom ? 'pointer-events-none translate-y-2 opacity-0' : 'opacity-100'
        }`}
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4" aria-hidden="true">
          <path d="M10 4v12M5 11l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </main>
  )
}
