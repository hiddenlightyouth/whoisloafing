export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <a
      href="/"
      onClick={(event) => {
        if (!onClick) return
        event.preventDefault()
        onClick()
      }}
      className="inline-flex items-center"
    >
      <img src="/logo.svg" alt="WhoIsLoafing" width={3403} height={367} draggable={false} className="h-[14px] w-auto translate-y-px" />
    </a>
  )
}
