import { ContributionBackdrop } from './ContributionBackdrop'
import { RepoInput } from './RepoInput'

export function Hero({ onSubmit }: { onSubmit: (url: string) => void }) {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-5 pb-[12vh]">
      <ContributionBackdrop />
      <div className="relative w-full max-w-lg animate-rise">
        <h1 className="text-balance text-center text-[24px] font-semibold leading-snug text-gray-900 sm:text-[30px]">
          누가 어떤 기능을 얼마나 많이 만들었을까요?
        </h1>
        <div className="mt-7 sm:mt-8">
          <RepoInput onSubmit={onSubmit} />
        </div>
      </div>
    </main>
  )
}
