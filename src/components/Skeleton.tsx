export function Bone({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`block rounded-full bg-gray-100 motion-safe:animate-pulse ${className}`} />
}

export function ChatSkeleton() {
  const bubble = 'rounded-2xl motion-safe:animate-pulse'

  return (
    <main className="flex min-h-0 flex-1 flex-col" aria-busy="true">
      <span className="sr-only">채팅을 불러오고 있어요.</span>
      <div className="flex-1 overflow-hidden px-4 pt-14 sm:px-6" aria-hidden>
        <div className="mx-auto flex max-w-2xl flex-col gap-2.5 pt-6">
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
