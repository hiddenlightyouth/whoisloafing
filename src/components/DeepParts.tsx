import { useEffect, useRef, useState, type ReactNode } from 'react'
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

export interface MenuItem {
  label: string
  /** 오른쪽에 옅게 붙는 값 (커밋 수 등) */
  hint?: string
  checked?: boolean
  onSelect: () => void
}

export interface MenuGroup {
  title?: string
  items: MenuItem[]
  /** 항목 대신 보여줄 안내 (불러오는 중, 오류 등) */
  note?: string
}

/** 맵과 캔버스 위에 떠 있는 도구 버튼의 모양이에요. */
export const toolButton =
  'flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-[12.5px] font-medium text-gray-700 transition-colors hover:border-gray-300 hover:text-gray-900'

/**
 * 버튼을 누르면 아래로 펼쳐지는 메뉴예요. 심층 분석의 보기 옵션, 참여자, 워크플로와 템플릿 고르기에 같이 써요.
 * 고른 항목에는 체크 표시가 붙고, 바깥을 누르거나 Esc를 누르면 닫혀요.
 */
export function MapMenu({ label, value, active = false, groups, onOpen, icon }: {
  label: string
  /** 지금 고른 값. 있으면 버튼에 이름 옆으로 보여줘요. */
  value?: string
  active?: boolean
  groups: MenuGroup[]
  /** 메뉴를 열 때 불러요. 내용을 그때 받아 올 때 써요. */
  onOpen?: () => void
  icon?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          if (!open) onOpen?.()
          setOpen((value) => !value)
        }}
        className={`${toolButton} ${active ? 'border-brand text-brand-hover hover:border-brand hover:text-brand-hover' : ''}`}
      >
        {icon}
        <span className="text-gray-500">{label}</span>
        {value && <span className="max-w-40 truncate">{value}</span>}
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className={`size-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true">
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div role="menu" className="absolute top-full left-0 z-10 mt-1.5 max-h-[60dvh] w-60 animate-rise overflow-y-auto rounded-xl border border-gray-200 bg-white p-1">
          {groups.map((group, index) => (
            <div key={group.title ?? index} className={index > 0 ? 'mt-1 border-t border-gray-100 pt-1' : ''}>
              {group.title && <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-gray-400">{group.title}</p>}
              {group.note && <p className="px-2.5 py-1.5 text-[12.5px] leading-relaxed text-gray-500">{group.note}</p>}
              {group.items.map((item, order) => (
                <button
                  key={`${order}:${item.label}`}
                  type="button"
                  role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
                  aria-checked={item.checked}
                  onClick={() => {
                    setOpen(false)
                    item.onSelect()
                  }}
                  className="flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[13px] text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
                >
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.hint && <span className="shrink-0 text-[11.5px] text-gray-400 tabular-nums">{item.hint}</span>}
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className={`size-3.5 shrink-0 text-brand ${item.checked ? '' : 'invisible'}`} aria-hidden="true">
                    <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
