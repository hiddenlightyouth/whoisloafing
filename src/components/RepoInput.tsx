import { useState, type FormEvent } from 'react'

export function RepoInput({ onSubmit }: { onSubmit: (url: string) => void }) {
  const [value, setValue] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const url = value.trim()
    if (!url) return
    onSubmit(url)
    setValue('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full gap-2">
      <input
        type="text"
        inputMode="url"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="github.com/owner/repo"
        aria-label="GitHub 레포 링크"
        className="h-14 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-5 text-base text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-brand focus:ring-4 focus:ring-brand/15"
      />
      <button
        type="submit"
        className="h-14 shrink-0 rounded-xl bg-brand px-7 text-base font-semibold text-white transition-colors hover:bg-brand-hover"
      >
        분석
      </button>
    </form>
  )
}
