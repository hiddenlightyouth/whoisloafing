import { useRef, useState } from 'react'
import { useDismiss } from '../hooks/useDismiss'
import { track } from '../lib/analytics'
import { Kbd } from './Shortcuts'
import { messages, useMessages } from '../lib/i18n'
import { CheckIcon, ChevronDownIcon } from './Icons'

const TEXT = messages({
  ko: { copied: '복사했어요', copyFailed: '복사하지 못했어요', copy: '복사', loading: '불러오고 있어요.' },
  en: { copied: 'Copied', copyFailed: "Couldn't copy", copy: 'Copy', loading: 'Loading.' },
})

/** 심층 분석의 작은 이름표 모양이에요. 작동 조건, 라벨, 고를 수 있는 값, 파일 이름에 같이 써요. */
export const tag = 'inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-[12.5px] text-gray-700'

/** 원문을 클립보드에 복사하는 작은 버튼이에요. */
function CopyText({ text, kind }: { text: string; kind: string }) {
  const L = useMessages(TEXT)
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
    <button type="button" onClick={copy} className={`${toolButton} shrink-0`}>
      {state === 'done' ? L.copied : state === 'failed' ? L.copyFailed : L.copy}
    </button>
  )
}

/**
 * 워크플로나 템플릿의 원문을 그대로 보여주는 칸이에요.
 * marks가 있으면 그 줄 왼쪽에 동그라미 번호를 붙여서, 원문의 어느 부분이 몇 번째로 도는지 알 수 있게 해요.
 */
export function Source({ path, content, kind, marks = {} }: { path: string; content: string; kind: string; marks?: Record<number, number> }) {
  const marked = Object.keys(marks).length > 0
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 font-mono text-[12.5px] tracking-normal break-all text-gray-500">{path}</p>
        <CopyText text={content} kind={kind} />
      </div>
      <div className="mt-3 overflow-x-auto rounded-lg bg-gray-50 py-3 font-mono text-[12.5px] leading-[22px] tracking-normal text-gray-700">
        {content.split('\n').map((line, index) => {
          const order = marks[index + 1]
          return (
            <div key={index} className={`flex ${order ? 'bg-brand-soft' : ''}`}>
              {marked && (
                <span className="flex w-9 shrink-0 justify-center select-none" aria-hidden={!order}>
                  {order && (
                    <span className="mt-[2px] flex size-[18px] items-center justify-center rounded-full bg-brand font-sans text-[11px] font-semibold text-white tabular-nums">
                      {order}
                    </span>
                  )}
                </span>
              )}
              <span className={`min-w-0 flex-1 pr-4 whitespace-pre-wrap ${marked ? '' : 'pl-4'}`}>{line || ' '}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface MenuItem {
  label: string
  /** 오른쪽에 옅게 붙는 값 (커밋 수 등) */
  hint?: string
  /** 이 항목의 단축키. 오른쪽에 자판 모양으로 보여줘요. */
  shortcut?: string
  checked?: boolean
  onSelect: () => void
}

export interface MenuGroup {
  title?: string
  items: MenuItem[]
  /** 항목 대신 보여줄 안내 (오류 등) */
  note?: string
  /** 불러오는 중이면 true. 항목 대신 스켈레톤을 보여줘요. */
  loading?: boolean
}

/** 맵과 캔버스 위에 떠 있는 도구 버튼의 모양이에요. */
export const toolButton =
  'flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 text-[13px] font-medium text-gray-800 transition-colors hover:border-gray-300 hover:text-gray-950'

/**
 * 버튼을 누르면 아래로 펼쳐지는 메뉴예요. 심층 분석의 보기 옵션, 참여자, 워크플로와 템플릿 고르기에 같이 써요.
 * 고른 항목에는 체크 표시가 붙고, 바깥을 누르거나 Esc를 누르면 닫혀요.
 */
export function MapMenu({ label, value, active = false, groups, onOpen }: {
  /** 버튼에 적는 이름. 고른 값만 보여줘도 뜻이 통하면 넘기지 않아요. */
  label?: string
  /** 지금 고른 값. 있으면 버튼에 이름 옆으로 보여줘요. */
  value?: string
  active?: boolean
  groups: MenuGroup[]
  /** 메뉴를 열 때 불러요. 내용을 그때 받아 올 때 써요. */
  onOpen?: () => void
}) {
  const L = useMessages(TEXT)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // 맵은 끌어서 옮기는 동작과 겹치지 않게 메뉴 줄의 누름을 바깥으로 흘려보내지 않아요.
  // 그래서 흘러나오기 전에(캡처 단계에서) 먼저 받아야, 옆의 다른 메뉴를 눌렀을 때도 이 메뉴가 닫혀요.
  useDismiss(open, ref, () => setOpen(false), { capture: true })

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
        className={`${toolButton} ${active ? 'border-brand! text-brand-hover!' : ''}`}
      >
        {label && <span className="text-gray-500">{label}</span>}
        {value && <span className="max-w-40 truncate">{value}</span>}
        <ChevronDownIcon className={`size-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div role="menu" className="absolute top-full left-0 z-10 mt-2 max-h-[60dvh] w-64 origin-top-left animate-pop overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5">
          {groups.map((group, index) => (
            <div key={group.title ?? index} className={index > 0 ? 'mt-1 border-t border-gray-100 pt-1' : ''}>
              {group.title && <p className="px-3 pt-2 pb-1 text-[12px] font-medium text-gray-400">{group.title}</p>}
              {group.note && <p className="px-3 py-2 text-[13px] leading-relaxed text-gray-500">{group.note}</p>}
              {group.loading && (
                <div aria-busy="true">
                  <span className="sr-only">{L.loading}</span>
                  {['w-24', 'w-32', 'w-20', 'w-28', 'w-24'].map((width, order) => (
                    <div key={order} aria-hidden className="flex h-9 items-center justify-between px-3">
                      <span className={`h-3 rounded-full bg-gray-100 motion-safe:animate-pulse ${width}`} />
                      <span className="h-3 w-10 rounded-full bg-gray-100 motion-safe:animate-pulse" />
                    </div>
                  ))}
                </div>
              )}
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
                  className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-[13.5px] text-gray-800 transition-colors hover:bg-gray-50"
                >
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.hint && <span className="shrink-0 text-[12px] text-gray-400 tabular-nums">{item.hint}</span>}
                  {item.shortcut && <Kbd>{item.shortcut}</Kbd>}
                  <CheckIcon className={`size-3.5 shrink-0 text-brand ${item.checked ? '' : 'invisible'}`} />
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
