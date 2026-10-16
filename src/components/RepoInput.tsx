import { useEffect, useRef, useState, type FormEvent } from 'react'
import { parseRepoUrl } from '../../shared/repo'
import { track } from '../lib/analytics'
import { messages, useMessages } from '../lib/i18n'
import { ModelMenu } from './ModelMenu'

const TEXT = messages({
  ko: { label: 'GitHub 레포 링크', submit: '분석', invalid: '올바른 링크가 맞는지 확인해 주세요' },
  en: { label: 'GitHub repository link', submit: 'Analyze', invalid: 'Please check that the repository link is correct' },
})

/** 탐색에서 고른 레포처럼, 입력창에 미리 넣어 둘 링크. key가 바뀔 때마다 다시 넣어요. */
export interface RepoDraft {
  url: string
  key: number
}

export function RepoInput({ onSubmit, draft }: { onSubmit: (url: string) => void; draft?: RepoDraft | null }) {
  const text = useMessages(TEXT)
  const [value, setValue] = useState(draft?.url ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  const [invalid, setInvalid] = useState(false)
  // 흔들림이 끝나면 꺼 뒀다가, 잘못된 링크를 다시 내면 또 흔들어요.
  const [shaking, setShaking] = useState(false)

  // 링크를 넣어 두기만 하고 분석은 시작하지 않아요. 분석 버튼을 누르면 평소처럼 시작 창이 떠요.
  useEffect(() => {
    if (!draft) return
    setValue(draft.url)
    setInvalid(false)
    inputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    inputRef.current?.focus({ preventScroll: true })
  }, [draft])

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
          ref={inputRef}
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setInvalid(false)
          }}
          placeholder="https://github.com/owner/repository"
          data-repo-input
          aria-label={text.label}
          aria-invalid={invalid}
          aria-describedby={invalid ? 'repo-input-error' : undefined}
          // 모바일에서 글자가 16px보다 작으면 입력창을 누를 때 화면이 확대돼서, 모바일에서는 16px로 둬요.
          className="h-full min-w-0 flex-1 bg-transparent text-base text-gray-900 outline-none placeholder:text-gray-400 sm:text-[14px]"
        />
        <ModelMenu className="mr-1" />
        <button
          type="submit"
          className="h-10 shrink-0 rounded-full bg-brand px-5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover active:scale-[0.98]"
        >
          {text.submit}
        </button>
      </form>

      {invalid && (
        <p
          id="repo-input-error"
          role="alert"
          className="absolute top-full left-5 mt-2.5 origin-top-left animate-pop rounded-lg bg-red-500 px-3 py-1.5 text-[13px] font-medium text-white"
        >
          {/* 입력창을 가리키는 말풍선 꼬리 */}
          <span className="absolute -top-1 left-4 size-2 rotate-45 rounded-[1px] bg-red-500" aria-hidden="true" />
          {text.invalid}
        </p>
      )}
    </div>
  )
}
