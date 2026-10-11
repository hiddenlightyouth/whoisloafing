import { track } from '../lib/analytics'
import { isApp } from '../lib/app'
import { useAppSettings } from '../lib/theme'
import { ContributionBackdrop } from './ContributionBackdrop'
import { RepoInput } from './RepoInput'

/** 타이틀을 어절 단위로 나눠요. 어절이 하나씩 흐릿하게 떠오르며 나타나요. */
// 앱에서는 사이드바의 새 분석으로 들어오는 화면이라, 제목과 설명을 짧게 바꿔요.
const TITLE = isApp ? '새 분석 시작하기' : '우리 프로젝트의 MVP는?'
const TITLE_WORDS = TITLE.split(' ')
const WORD_STAGGER_MS = 80

function Title() {
  return (
    <h1
      aria-label={TITLE}
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
  const { backdrop } = useAppSettings()
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-5">
      {/* 앱에서는 설정에서 켰을 때만 배경 그림을 보여줘요. 브라우저에서는 늘 보여요. */}
      {backdrop && <ContributionBackdrop />}
      {/* 타이틀, 설명, 입력창을 한 덩어리로 묶어서, 그 덩어리가 화면 정중앙에 오게 해요. */}
      <div className="relative w-full max-w-lg">
        <Title />
        <p
          className="mt-3 mb-7 animate-rise text-balance break-keep text-center text-[13px] leading-relaxed text-gray-500 sm:mb-8 sm:text-[14px]"
          style={{ animationDelay: '250ms' }}
        >
          {isApp
            ? 'GitHub Repository 링크를 입력하여 프로젝트에 대해 분석을 시작하세요'
            : 'GitHub Repository 링크를 입력하여 누가 프로젝트에 가장 많이 기여했는지, 어떤 기능을 개발했는지 그리고 이 프로젝트의 협업 방식을 알아보거나 훔칠 수도 있답니다.'}
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
