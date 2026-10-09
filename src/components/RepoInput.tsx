import { useState, type FormEvent } from 'react'

interface Props {
  onSubmit: (url: string) => void
  disabled?: boolean
  size?: 'lg' | 'md'
  autoFocus?: boolean
}

export function RepoInput({ onSubmit, disabled = false, size = 'md', autoFocus = false }: Props) {
  const [value, setValue] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const url = value.trim()
    if (!url || disabled) return
    onSubmit(url)
    setValue('')
  }

  const large = size === 'lg'

  return (
    <form onSubmit={handleSubmit} className="flex w-full gap-2">
      <input
        type="text"
        inputMode="url"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="github.com/owner/repo"
        aria-label="GitHub 레포 링크"
        className={`min-w-0 flex-1 rounded-xl border border-gray-200 bg-white text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-brand focus:ring-4 focus:ring-brand/15 ${
          large ? 'h-14 px-5 text-base' : 'h-12 px-4 text-[15px]'
        }`}
      />
      <button
        type="submit"
        disabled={disabled}
        className={`shrink-0 rounded-xl bg-brand font-semibold text-white transition-colors hover:bg-brand-hover disabled:bg-gray-200 disabled:text-gray-400 ${
          large ? 'h-14 px-7 text-base' : 'h-12 px-5 text-[15px]'
        }`}
      >
        분석
      </button>
    </form>
  )
}
