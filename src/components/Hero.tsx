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
    </main>
  )
}
