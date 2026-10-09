export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <a
      href="/"
      onClick={(event) => {
        if (!onClick) return
        event.preventDefault()
        onClick()
      }}
      className="font-logo text-[17px] font-extrabold tracking-tight text-gray-900"
    >
      WhoIsLoafing
    </a>
  )
}
