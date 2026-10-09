import { RepoInput } from './RepoInput'

export function Hero({ onSubmit }: { onSubmit: (url: string) => void }) {
  return (
    <main className="flex flex-1 items-center justify-center px-5 pb-[14vh]">
      <div className="w-full max-w-xl">
        <h1 className="text-balance text-center text-[30px] font-bold leading-[1.3] text-gray-900 sm:text-[44px]">
          누가 어떤 기능을 얼마나 많이 만들었을까요?
        </h1>
        <div className="mt-9 sm:mt-11">
          <RepoInput onSubmit={onSubmit} />
        </div>
      </div>
    </main>
  )
}
