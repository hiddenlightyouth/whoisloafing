import { useRef, useState, type ReactNode } from 'react'
import { useDismiss } from '../hooks/useDismiss'
import { messages, useMessages } from '../lib/i18n'
import { showToast } from '../lib/toast'
import { toolButton } from './DeepParts'
import { BackIcon, ChevronDownIcon } from './Icons'

/**
 * 앱 화면(심층 분석, 탐색, 포트폴리오, 이력서, 관리자, 내 정보)이 같이 쓰는 틀이에요.
 * 제목 줄, 회색 바탕, 단계 표시, 아래 버튼 줄, 다듬기 칸, 복사 버튼을 한 모양으로 맞춰요.
 * 새 앱 화면도 이것을 써서 따로 만들지 않아요.
 */

const TEXT = messages({
  ko: { back: '뒤로 가기', copied: '복사했어요', copyFailed: '복사하지 못했어요', steps: '진행 단계', export: '내보내기' },
  en: { back: 'Back', copied: 'Copied', copyFailed: 'Could not copy', steps: 'Steps', export: 'Export' },
})

/** 앱 화면의 바깥 틀이에요. 위의 헤더(56px)만큼 비우고 좌우 여백을 둬요. */
export const pageFrame = 'flex min-h-0 flex-1 flex-col px-6 pt-14 md:px-10'

/** 제목 줄 아래를 좌우 여백 없이 가득 채우는 옅은 회색 바탕이에요. pageFrame 안에서 써요. */
export const canvas = '-mx-6 flex min-h-0 flex-1 flex-col border-t border-gray-200 bg-gray-50 md:-mx-10'

/** 회색 바탕 위에 올리는 흰 종이예요. 이력서와 포트폴리오 미리보기가 같이 써요. */
export const paper = 'mx-auto w-full max-w-[880px] rounded-xl border border-gray-200 bg-white px-6 py-8 md:px-12 md:py-12'

/** 목록 아래의 더 보기 버튼이에요. 회색 바탕 위에 흰 알약으로 떠요. */
export const moreButton =
  'h-9 rounded-full border border-gray-200 bg-white px-4 text-[13px] font-medium text-gray-700 transition-colors hover:text-brand disabled:text-gray-400'

/** 줄 안에서 쓰는 작은 글자 버튼(다듬기 등)이에요. */
export const ghostButton =
  'h-8 shrink-0 rounded-md px-2 text-[12.5px] font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:text-gray-300 disabled:hover:bg-transparent'

/** 줄 안에서 쓰는 작은 아이콘 버튼(빼기, 옮기기 등)이에요. */
export const iconButton =
  'flex size-8 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:text-gray-200 disabled:hover:bg-transparent'

/**
 * 앱 화면 맨 위의 제목 줄이에요. 레포를 보는 화면이면 제목 위에 소유자를 작게 적고, 왼쪽에 뒤로 가기를 둬요.
 * 오른쪽에는 그 화면의 버튼을 둬요. 탭이 있으면 이 줄 바로 아래에 붙여요.
 */
export function PageHeader({ title, owner, onBack, backLabel, actions }: {
  title: string
  owner?: string
  onBack?: () => void
  backLabel?: string
  actions?: ReactNode
}) {
  const L = useMessages(TEXT)
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 pt-4 pb-4">
      <div className="flex min-h-11 min-w-0 items-center gap-2">
        {onBack && (
          <button
            type="button"
            aria-label={backLabel ?? L.back}
            onClick={onBack}
            className="-ml-2 flex size-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            <BackIcon />
          </button>
        )}
        <div className="min-w-0">
          {owner && <p className="text-[12px] text-gray-500">{owner}</p>}
          <h1 className="truncate text-[20px] leading-tight font-semibold text-gray-900">{title}</h1>
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** 단계를 차례로 정하는 화면의 번호 붙은 단계 표시예요. 눌러서 오가요. */
export function Steps<K extends string>({ steps, current, onSelect }: {
  steps: { key: K; label: string; disabled?: boolean }[]
  current: K
  onSelect: (key: K) => void
}) {
  const L = useMessages(TEXT)
  const index = steps.findIndex((item) => item.key === current)
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label={L.steps}>
      {steps.map((item, order) => (
        <li key={item.key} className="flex items-center gap-2">
          <button
            type="button"
            aria-current={item.key === current ? 'step' : undefined}
            disabled={item.disabled}
            onClick={() => onSelect(item.key)}
            className={`flex h-8 items-center gap-2 rounded-full px-3 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              item.key === current ? 'bg-white text-gray-900 ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <span
              className={`flex size-5 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${
                order <= index ? 'bg-brand text-white' : 'bg-gray-200 text-gray-500'
              }`}
            >
              {order + 1}
            </span>
            {item.label}
          </button>
          {order < steps.length - 1 && <span aria-hidden className="h-px w-4 bg-gray-300" />}
        </li>
      ))}
    </ol>
  )
}

/** 단계 화면의 내용 칸과 아래 버튼 줄이에요. 회색 바탕 위에 640px 폭으로 가운데에 둬요. */
export function StepLayout({ top, children, error, buttons }: {
  /** 내용 위에 두는 단계 표시 */
  top?: ReactNode
  children: ReactNode
  /** 아래 줄 왼쪽에 빨갛게 보여줄 오류 */
  error?: string
  buttons: ReactNode
}) {
  return (
    <div className={canvas}>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 md:px-10">
        <div className="mx-auto w-full max-w-[640px]">
          {top && <div className="mb-8">{top}</div>}
          {children}
        </div>
      </div>
      <div className="shrink-0 border-t border-gray-200 bg-white px-6 py-3 md:px-10">
        <div className="mx-auto flex w-full max-w-[640px] items-center justify-between gap-3">
          {error ? <p className="min-w-0 text-[13px] text-red-500">{error}</p> : <span />}
          <div className="flex shrink-0 items-center gap-2">{buttons}</div>
        </div>
      </div>
    </div>
  )
}

/** 단계 화면의 제목과 한 줄 설명이에요. */
export function StepTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <>
      <h2 className="text-[19px] font-semibold text-gray-900">{title}</h2>
      {hint && <p className="mt-1.5 text-[13.5px] text-gray-500">{hint}</p>}
    </>
  )
}

/** 기획안을 붙여 넣는 칸이에요. 글자 수를 오른쪽 아래에 적어요. */
export function PlanField({ value, max, placeholder, onChange }: { value: string; max: number; placeholder: string; onChange: (value: string) => void }) {
  return (
    <>
      <textarea
        value={value}
        maxLength={max}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-5 h-72 w-full resize-none rounded-xl border border-gray-200 bg-white p-4 text-[14px] leading-relaxed text-gray-900 outline-none placeholder:text-gray-400 focus:border-brand"
      />
      <p className="mt-1.5 text-right text-[12px] text-gray-400 tabular-nums">
        {value.length.toLocaleString()} / {max.toLocaleString()}
      </p>
    </>
  )
}

/**
 * 다듬기를 누르면 펼쳐지는 작은 칸이에요. 고칠 방향을 글로 적지 않고 골라요.
 * 다듬기 버튼을 다시 누른 것은 버튼이 알아서 닫아요.
 */
export function RevisionPicker<K extends string>({ title, options, onPick, onClose, className = '' }: {
  title: string
  options: { key: K; label: string }[]
  onPick: (key: K) => void
  onClose: () => void
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(true, ref, onClose, { capture: true, ignore: (target) => !!target.closest('[aria-expanded="true"]') })

  return (
    <div ref={ref} role="dialog" aria-label={title} className={`origin-top-left animate-pop rounded-lg border border-gray-200 bg-white px-3 pt-2.5 pb-3 ${className}`}>
      <p className="text-[12.5px] font-medium text-gray-500">{title}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onPick(item.key)}
            className="h-7 rounded-md border border-gray-200 bg-white px-2.5 text-[12.5px] text-gray-700 transition-colors hover:border-brand hover:text-brand-hover"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** 내보내기 메뉴의 항목 하나. 누르면 복사하고 됐는지 돌려줘요. */
export interface ExportItem {
  label: string
  run: () => Promise<boolean>
}

/**
 * 제목 줄에 두는 내보내기 버튼이에요. 복사 방법이 여러 가지여도 버튼은 하나만 두고, 누르면 아래로 고르는 메뉴가 펼쳐져요.
 * 고르면 바로 복사하고 결과는 토스트로 알려줘요.
 */
export function ExportMenu({ items }: { items: ExportItem[] }) {
  const L = useMessages(TEXT)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(open, ref, () => setOpen(false))

  async function pick(item: ExportItem) {
    setOpen(false)
    showToast((await item.run()) ? L.copied : L.copyFailed)
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)} className={`${toolButton} whitespace-nowrap`}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
          <path d="M8 10V2.5M5 5.5l3-3 3 3M3 9.5v3a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3" />
        </svg>
        {L.export}
        <ChevronDownIcon className={`size-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="menu" className="absolute top-full right-0 z-20 mt-2 w-48 origin-top-right animate-pop rounded-xl border border-gray-200 bg-white p-1.5">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => void pick(item)}
              className="flex h-9 w-full items-center rounded-lg px-3 text-left text-[13px] text-gray-800 transition-colors hover:bg-gray-100"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** 글을 클립보드에 복사하고 됐는지 알려줘요. */
export const copyText = (text: string) =>
  navigator.clipboard.writeText(text).then(
    () => true,
    () => false,
  )

/** 서식(HTML)과 글을 같이 복사해요. 워드나 구글 문서, 노션에 붙이면 서식이 그대로 나와요. 막는 브라우저에서는 글만 복사해요. */
export async function copyRich(html: string, plain: string): Promise<boolean> {
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      }),
    ])
    return true
  } catch {
    return copyText(plain)
  }
}
