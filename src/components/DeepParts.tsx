import { useState } from 'react'
import { track } from '../lib/analytics'

const pill =
  'shrink-0 rounded-full bg-brand-soft px-3 py-1 text-[12px] font-medium text-brand-hover transition-colors hover:bg-brand hover:text-white'

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
