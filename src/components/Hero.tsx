import { useEffect, useState } from 'react'
import { track } from '../lib/analytics'
import { ContributionBackdrop } from './ContributionBackdrop'
import { RepoInput } from './RepoInput'

/** 타이틀을 어절 단위로 나눠요. focus가 있는 어절은 차례로 메인 컬러로 물들어요. */
const TITLE_WORDS: { text: string; focus?: number }[] = [
  { text: '누가', focus: 0 },
  { text: '어떤', focus: 1 },
  { text: '기능을', focus: 1 },
  { text: '얼마나', focus: 2 },
  { text: '많이', focus: 2 },
  { text: '만들었을까요?' },
]
const FOCUS_COUNT = 3
const FOCUS_INTERVAL_MS = 1800
const WORD_STAGGER_MS = 80

function Title() {
  const [focus, setFocus] = useState(-1)

  // 어절이 모두 나타난 뒤부터 "누가", "어떤 기능을", "얼마나 많이"를 차례로 짚어요.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let interval: ReturnType<typeof setInterval> | undefined
    const start = setTimeout(() => {
      setFocus(0)
      interval = setInterval(() => setFocus((current) => (current + 1) % FOCUS_COUNT), FOCUS_INTERVAL_MS)
    }, TITLE_WORDS.length * WORD_STAGGER_MS + 500)
    return () => {
      clearTimeout(start)
      clearInterval(interval)
    }
  }, [])

  return (
    <h1
      aria-label="누가 어떤 기능을 얼마나 많이 만들었을까요?"
      className="mb-7 text-balance text-center text-[24px] font-semibold leading-snug text-gray-900 sm:mb-8 sm:text-[30px]"
    >
      {TITLE_WORDS.map((word, index) => (
        <span key={index} aria-hidden="true">
          <span
            className={`inline-block animate-word transition-colors duration-500 ${word.focus === focus ? 'text-brand' : ''}`}
            style={{ animationDelay: `${index * WORD_STAGGER_MS}ms` }}
          >
            {word.text}
          </span>
          {index < TITLE_WORDS.length - 1 && ' '}
        </span>
      ))}
    </h1>
  )
}

export function Hero({ onSubmit }: { onSubmit: (url: string) => void }) {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-5">
      <ContributionBackdrop />
      {/* 타이틀과 입력창을 한 덩어리로 묶어서, 그 덩어리가 화면 정중앙에 오게 해요. */}
      <div className="relative w-full max-w-lg">
        <Title />
        <div className="animate-rise" style={{ animationDelay: '350ms' }}>
          <RepoInput onSubmit={onSubmit} />
        </div>
      </div>

      <footer className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 whitespace-nowrap px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-[11px] text-gray-400 sm:px-6 sm:text-xs">
        <a
          href="https://hidly.dev/"
          target="_blank"
          rel="noreferrer"
          onClick={() => track('team_link_click')}
          className="inline-flex items-center gap-1 transition-colors hover:text-gray-700"
        >
          숨은빚청년들 팀
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" className="size-3" aria-hidden="true">
            <path d="M3.5 8.5l5-5M4.5 3.5h4v4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
        <span>© 2026 WhoIsLoafing. 모든 권리 보유.</span>
      </footer>
    </main>
  )
}
