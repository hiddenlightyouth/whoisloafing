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
    // 입력창과 버튼을 하나의 둥근 칸 안에 담아요. 반투명한 유리처럼 뒤 배경이 흐릿하게 비쳐요.
    <form
      onSubmit={handleSubmit}
      className="flex h-[52px] w-full items-center rounded-full border border-gray-200/90 bg-white/55 pr-1.5 pl-5 backdrop-blur-md shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.12)]"
    >
      <input
        type="text"
        inputMode="url"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="GitHub 레포지토리 링크를 입력해 보세요!"
        aria-label="GitHub 레포 링크"
        className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-gray-900 outline-none placeholder:text-gray-400"
      />
      <button
        type="submit"
        className="h-10 shrink-0 rounded-full bg-brand px-5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover active:scale-[0.98]"
      >
        분석
      </button>
    </form>
  )
}
