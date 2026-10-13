import { isApp } from '../lib/app'

export function Bone({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`block rounded-full bg-gray-100 motion-safe:animate-pulse ${className}`} />
}

export function ChatSkeleton() {
  const bubble = 'rounded-2xl motion-safe:animate-pulse'

  return (
    <main className="flex min-h-0 flex-1 flex-col" aria-busy="true">
      <span className="sr-only">채팅을 불러오고 있어요.</span>
      <div className={`flex-1 overflow-hidden pt-14 ${isApp ? 'px-6 md:pl-10 xl:pr-[348px]' : 'px-4 sm:px-6'}`} aria-hidden>
        <div className={`flex max-w-2xl flex-col gap-2.5 pt-6 ${isApp ? 'mr-auto' : 'mx-auto'}`}>
          <div className={`${bubble} ml-auto h-11 w-3/5 rounded-br-md bg-brand-soft`} />
          <div className={`${bubble} h-11 w-2/3 bg-gray-100`} />
          <div className={`${bubble} h-40 w-[85%] bg-gray-100`} />
          <div className={`${bubble} h-11 w-1/2 bg-gray-100`} />
          <div className={`${bubble} h-56 w-[85%] bg-gray-100`} />
          <div className={`${bubble} h-11 w-2/5 bg-gray-100`} />
        </div>
      </div>
    </main>
  )
}

/** 탐색의 레포 카드와 같은 크기와 배치의 뼈대예요. 목록을 받는 동안 보여줘요. */
export function ExploreCardsSkeleton({ row = false }: { row?: boolean }) {
  return (
    <ul
      className={
        row
          ? 'mt-3 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] auto-rows-[0px] grid-rows-[auto] gap-x-4 overflow-hidden'
          : 'mt-4 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4'
      }
      aria-busy="true"
    >
      <li className="sr-only">불러오고 있어요.</li>
      {Array.from({ length: row ? 8 : 12 }, (_, item) => (
        <li key={item} aria-hidden className="flex h-[176px] min-h-0 flex-col rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <Bone className="size-12 shrink-0" />
            <div className="min-w-0 flex-1">
              <Bone className="h-3.5 w-3/5" />
              <Bone className="mt-2 h-3 w-2/5" />
            </div>
          </div>
          <div className="mt-4 flex-1">
            <Bone className="h-3 w-full" />
            <Bone className="mt-2 h-3 w-4/5" />
          </div>
          <div className="flex items-center justify-between">
            <Bone className="h-3 w-16" />
            <Bone className="h-3 w-12" />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** 새 분석 화면 아래에 붙는 탐색 맛보기의 뼈대예요. 서버가 탐색을 지원하는지 아직 모를 때와 탐색 코드를 받는 동안, 같은 자리를 미리 잡아 둬요. */
export function ExploreSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-9">
      {[0, 1].map((row) => (
        <section key={row}>
          <div className="flex h-8 items-center justify-between gap-4">
            <Bone className="h-4 w-24" />
            <Bone className="h-3.5 w-14" />
          </div>
          <ExploreCardsSkeleton row />
        </section>
      ))}
    </div>
  )
}
