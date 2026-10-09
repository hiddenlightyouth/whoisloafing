import { ContributionBackdrop } from './ContributionBackdrop'
import { RepoInput } from './RepoInput'

export function Hero({ onSubmit }: { onSubmit: (url: string) => void }) {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-5">
      <ContributionBackdrop />
      {/* 입력창이 화면 정중앙에 오도록, 타이틀은 흐름에서 빼서 입력창 위에 얹어요. */}
      <div className="relative w-full max-w-lg animate-rise">
        <h1 className="absolute inset-x-0 bottom-full mb-7 text-balance text-center text-[24px] font-semibold leading-snug text-gray-900 sm:mb-8 sm:text-[30px]">
          누가 어떤 기능을 얼마나 많이 만들었을까요?
        </h1>
        <RepoInput onSubmit={onSubmit} />
      </div>

      <footer className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 whitespace-nowrap px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-[11px] text-gray-400 sm:px-6 sm:text-xs">
        <a
          href="https://hidly.dev/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 transition-colors hover:text-gray-700"
        >
          숨은빛청년들 팀
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" className="size-3" aria-hidden="true">
            <path d="M3.5 8.5l5-5M4.5 3.5h4v4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
        <span>© 2026 WhoIsLoafing. All rights reserved.</span>
      </footer>
    </main>
  )
}
