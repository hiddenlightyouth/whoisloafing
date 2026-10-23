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
      <img src="/logo.svg" alt="Lofy" width={1506} height={501} draggable={false} className="h-[21px] w-auto" />
    </a>
  )
}
