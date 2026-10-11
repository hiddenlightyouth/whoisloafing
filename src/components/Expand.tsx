import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { track } from '../lib/analytics'
import { isApp } from '../lib/app'

interface Props {
  title: string
  /** 분석 이벤트에 남기는 그림의 종류 */
  kind: string
  /** large가 true면 크게 보기 창 안에 그리는 중이에요. 같은 그림을 넓은 자리에 맞게 다시 그려요. */
  children: (large: boolean) => ReactNode
}

const pill =
  'shrink-0 rounded-full bg-brand-soft px-3 py-1 text-[12px] font-medium text-brand-hover transition-colors hover:bg-brand hover:text-white'

/**
 * 말풍선 안의 그림을 흰 칸에 담고, 크게 보기 버튼을 붙여요.
 * 누르면 화면을 거의 다 덮는 창에 같은 그림을 크게 다시 그려요. 바깥을 누르거나 Esc를 누르면 닫혀요.
 */
export function Expandable({ title, kind, children }: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <div className="mt-3 mb-1.5 rounded-xl bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-xs font-medium text-gray-500">{title}</h3>
        <button
          type="button"
          onClick={() => {
            track('deep_expand', { kind })
            setOpen(true)
          }}
          className={pill}
        >
          크게 보기
        </button>
      </div>
      {children(false)}

      {open &&
        // 말풍선에는 등장 애니메이션이 걸려 있어서, 화면 전체를 덮으려면 말풍선 바깥에 그려야 해요.
        createPortal(
          <div
            className={`fixed inset-0 z-50 flex items-center justify-center bg-gray-900/25 p-3 backdrop-blur-[2px] sm:p-6 ${isApp ? 'pt-12 sm:pt-12' : ''}`}
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) setOpen(false)
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={title}
              className="flex h-full w-full max-w-5xl animate-rise flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white text-gray-900"
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 py-3 pr-3 pl-5">
                <h2 className="min-w-0 truncate text-[15px] font-semibold">{title}</h2>
                <button
                  type="button"
                  aria-label="닫기"
                  autoFocus
                  onClick={() => setOpen(false)}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-4" aria-hidden="true">
                    <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-5 text-[15px] leading-relaxed">{children(true)}</div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

/** 원문을 클립보드에 복사하는 작은 버튼이에요. */
export function CopyText({ text, kind }: { text: string; kind: string }) {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle')

  async function copy() {
    const ok = await navigator.clipboard.writeText(text).then(
      () => true,
      () => false,
    )
    track('deep_copy', { kind, success: ok })
    setState(ok ? 'done' : 'failed')
    setTimeout(() => setState('idle'), 2000)
  }

  return (
    <button type="button" onClick={copy} className={pill}>
      {state === 'done' ? '복사했어요' : state === 'failed' ? '복사하지 못했어요' : '복사하기'}
    </button>
  )
}

/** 워크플로나 템플릿의 원문을 그대로 보여주는 칸이에요. */
export function Source({ path, content, kind, tall = false }: { path: string; content: string; kind: string; tall?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 font-mono text-[12px] tracking-normal break-all text-gray-400">{path}</p>
        <CopyText text={content} kind={kind} />
      </div>
      <pre
        className={`mt-2 overflow-auto rounded-lg bg-gray-50 px-3 py-2.5 font-mono text-[12px] leading-relaxed tracking-normal whitespace-pre-wrap text-gray-700 ${tall ? 'max-h-[60dvh]' : 'max-h-60'}`}
      >
        {content}
      </pre>
    </div>
  )
}

/** 여러 개 중 하나를 고르는 작은 탭이에요. 워크플로나 템플릿이 여러 개일 때 써요. */
export function Tabs({ names, index, onSelect }: { names: string[]; index: number; onSelect: (index: number) => void }) {
  if (names.length < 2) return null
  return (
    <div className="mb-3 flex flex-wrap gap-1.5">
      {names.map((name, item) => (
        <button
          key={`${item}:${name}`}
          type="button"
          aria-pressed={item === index}
          onClick={() => onSelect(item)}
          className={`max-w-full truncate rounded-full px-3 py-1 text-[12.5px] font-medium transition-colors ${
            item === index ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600 hover:text-gray-900'
          }`}
        >
          {name}
        </button>
      ))}
    </div>
  )
}
