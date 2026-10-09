import { track } from '../lib/analytics'
import { ContributionBackdrop } from './ContributionBackdrop'
import { RepoInput } from './RepoInput'

/** 타이틀을 어절 단위로 나눠요. 어절이 하나씩 흐릿하게 떠오르며 나타나요. */
const TITLE_WORDS = ['우리', '프로젝트의', 'MVP는?']
const WORD_STAGGER_MS = 80

function Title() {
  return (
    <h1
      aria-label="우리 프로젝트의 MVP는?"
      className="text-balance text-center text-[24px] font-semibold leading-snug text-gray-900 sm:text-[30px]"
    >
      {TITLE_WORDS.map((word, index) => (
        <span key={index} aria-hidden="true">
          <span className="inline-block animate-word" style={{ animationDelay: `${index * WORD_STAGGER_MS}ms` }}>
            {word}
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
      {/* 타이틀, 설명, 입력창을 한 덩어리로 묶어서, 그 덩어리가 화면 정중앙에 오게 해요. */}
      <div className="relative w-full max-w-lg">
        <Title />
        <p
          className="mt-3 mb-7 animate-rise text-balance break-keep text-center text-[13px] leading-relaxed text-gray-500 sm:mb-8 sm:text-[14px]"
          style={{ animationDelay: '250ms' }}
        >
          GitHub 레포지토리의 링크를 입력하여 통계를 분석해 누가 가장 많이 기여했고, 기여자 별로 어떤 기능을 담당했는지 쉽게 알아볼 수
          있어요.
        </p>
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
