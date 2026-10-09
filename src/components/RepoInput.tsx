import { useState, type FormEvent } from 'react'
import { parseRepoUrl } from '../../shared/repo'
import { track } from '../lib/analytics'

export function RepoInput({ onSubmit }: { onSubmit: (url: string) => void }) {
  const [value, setValue] = useState('')
  const [invalid, setInvalid] = useState(false)
  // 흔들림이 끝나면 꺼 뒀다가, 잘못된 링크를 다시 내면 또 흔들어요.
  const [shaking, setShaking] = useState(false)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const url = value.trim()
    if (!parseRepoUrl(url)) {
      setInvalid(true)
      setShaking(true)
      track('repo_invalid_input', { length: url.length, looks_like_url: /^https?:\/\//i.test(url) })
      return
    }
    onSubmit(url)
    setValue('')
  }

  return (
    <div className="relative">
      {/* 입력창과 버튼을 하나의 둥근 칸 안에 담아요. 반투명한 유리처럼 뒤 배경이 흐릿하게 비쳐요. */}
      <form
        onSubmit={handleSubmit}
        onAnimationEnd={() => setShaking(false)}
        noValidate
        className={`flex h-[52px] w-full items-center rounded-full border bg-white/55 pr-1.5 pl-5 backdrop-blur-md transition-colors ${
          invalid ? 'border-red-400' : 'border-gray-200/90'
        } ${shaking ? 'animate-shake' : ''
        }`}
      >
        <input
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setInvalid(false)
          }}
          placeholder="GitHub 레포지토리 링크를 입력해 시작하세요!"
          aria-label="GitHub 레포 링크"
          aria-invalid={invalid}
          aria-describedby={invalid ? 'repo-input-error' : undefined}
          // 모바일에서 글자가 16px보다 작으면 입력창을 누를 때 화면이 확대돼서, 모바일에서는 16px로 둬요.
          className="h-full min-w-0 flex-1 bg-transparent text-base text-gray-900 outline-none placeholder:text-gray-400 sm:text-[15px]"
        />
        <button
          type="submit"
          className="h-10 shrink-0 rounded-full bg-brand px-5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover active:scale-[0.98]"
        >
          분석
        </button>
      </form>

      {invalid && (
        <p
          id="repo-input-error"
          role="alert"
          className="absolute top-full left-5 mt-2.5 animate-rise rounded-lg bg-red-500 px-3 py-1.5 text-[13px] font-medium text-white"
        >
          {/* 입력창을 가리키는 말풍선 꼬리 */}
          <span className="absolute -top-1 left-4 size-2 rotate-45 rounded-[1px] bg-red-500" aria-hidden="true" />
          올바른 링크가 맞는지 확인해 주세요
        </p>
      )}
    </div>
  )
}
