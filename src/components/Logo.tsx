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
      <img src="/logo.svg" alt="WhoIsLoafing" width={3401} height={304} draggable={false} className="h-[15px] w-auto" />
    </a>
  )
}
