import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Result } from '../lib/admin'
import type { Slice } from '../lib/auth'
import { tag, toolButton } from './DeepParts'
import { Bone } from './Skeleton'

export const card = 'rounded-2xl border border-gray-200 bg-white p-4'
export const sectionTitle = 'text-[15px] font-semibold text-gray-900'
/** 표의 줄 안에 두는 작은 글자 버튼이에요. */
export const rowButton = 'h-7 shrink-0 rounded-md px-2 text-[12.5px] font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:text-gray-300'

export const full = (value: number) => value.toLocaleString('ko-KR')
const compactFormat = new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 })
export const compact = (value: number) => compactFormat.format(value)
export const share = (part: number, total: number) => (total > 0 ? `전체의 ${((part / total) * 100).toFixed(1)}%` : '전체의 0%')

/** 여러 값 중 하나를 고르는 칸이에요. 기간, 그래프에 보여줄 값, 목록의 필터에 같이 써요. */
export function Segmented<T extends string | number>({ label, options, value, onChange }: {
  label: string
  options: readonly (readonly [T, string])[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex shrink-0 rounded-lg bg-gray-100 p-0.5">
      {options.map(([option, text]) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => {
            if (value !== option) onChange(option)
          }}
          className={`h-7 rounded-md px-2.5 text-[12.5px] font-medium whitespace-nowrap transition-colors ${
            value === option ? 'bg-white text-gray-900' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={card}>
      <dt className="text-[12.5px] text-gray-500">{label}</dt>
      <dd className="mt-1.5 text-[22px] leading-tight font-semibold text-gray-900 tabular-nums">{value}</dd>
      {note && <dd className="mt-1 text-[12px] text-gray-400 tabular-nums">{note}</dd>}
    </div>
  )
}

export function StatsSkeleton({ count }: { count: number }) {
  return (
    <div aria-hidden className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, item) => (
        <div key={item} className={card}>
          <Bone className="h-3 w-16" />
          <Bone className="mt-3 h-6 w-24" />
          <Bone className="mt-3 h-3 w-20" />
        </div>
      ))}
    </div>
  )
}

export interface Bar {
  key: string
  /** 마우스를 올리면 보여줄 말 */
  title: string
  value: number
}

/** 라이브러리 없이 그리는 막대 그래프예요. 막대에 마우스를 올리면 값이 나와요. */
export function BarChart({ bars, label, first, last }: { bars: Bar[]; label: string; first: string; last: string }) {
  const peak = Math.max(0, ...bars.map((bar) => bar.value))
  return (
    <>
      <div role="img" aria-label={label} className={`mt-4 flex h-40 items-end ${bars.length > 40 ? 'gap-px' : 'gap-1'}`}>
        {bars.map((bar) => (
          <div key={bar.key} title={bar.title} className="flex h-full min-w-0 flex-1 items-end rounded-sm transition-colors hover:bg-gray-100">
            <div className="w-full rounded-t-sm bg-brand" style={{ height: bar.value > 0 ? `${Math.max((bar.value / peak) * 100, 2)}%` : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[12px] text-gray-400 tabular-nums">
        <span>{first}</span>
        <span>{last}</span>
      </div>
    </>
  )
}

/** 그 회원이 로그인한 적이 있는 기기 종류예요. */
export function DeviceTags({ app, mobile, desktop }: { app: boolean; mobile: boolean; desktop: boolean }) {
  if (!app && !mobile && !desktop) return <span className="text-[12.5px] text-gray-400">기록 없음</span>
  return (
    <span className="flex flex-wrap gap-1">
      {app && <span className={tag}>앱</span>}
      {mobile && <span className={tag}>모바일</span>}
      {desktop && <span className={tag}>PC</span>}
    </span>
  )
}

/** 되돌리기 어려운 관리자 작업을 하기 전에 한 번 더 묻는 창이에요. */
export function ConfirmDialog({ title, body, confirm, danger = false, working, onCancel, onConfirm }: {
  title: string
  body: ReactNode
  confirm: string
  danger?: boolean
  working: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCancel()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/25 px-5 backdrop-blur-[2px]"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div role="alertdialog" aria-modal="true" aria-labelledby="admin-confirm-title" className="w-full max-w-sm animate-rise rounded-2xl border border-gray-200 bg-white p-5">
        <h2 id="admin-confirm-title" className="text-[15px] font-semibold text-gray-900">
          {title}
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed break-keep text-gray-500 [overflow-wrap:anywhere]">{body}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="h-9 rounded-full px-3.5 text-[13px] font-medium text-gray-600 transition-colors hover:text-gray-900">
            취소
          </button>
          <button
            type="button"
            autoFocus
            disabled={working}
            onClick={onConfirm}
            className={`h-9 rounded-full px-4 text-[13px] font-semibold text-white transition-colors disabled:bg-gray-200 disabled:text-gray-400 ${
              danger ? 'bg-red-500 hover:bg-red-600' : 'bg-brand hover:bg-brand-hover'
            }`}
          >
            {working ? '처리 중' : confirm}
          </button>
        </div>
      </div>
    </div>
  )
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 transition-colors focus-within:border-brand sm:max-w-xs">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-3.5 shrink-0 text-gray-400" aria-hidden="true">
        <circle cx="7" cy="7" r="4.5" />
        <path d="M10.5 10.5L14 14" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-gray-900 outline-none placeholder:text-gray-400"
      />
    </label>
  )
}

/** 글자를 치는 동안에는 기다렸다가, 잠깐 멈추면 값을 돌려줘요. 검색어마다 요청을 보내지 않게 해요. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), ms)
    return () => window.clearTimeout(timer)
  }, [value, ms])
  return settled
}

/**
 * 20개씩 더 보기로 받는 목록이에요. key가 바뀌면(검색어, 필터) 처음부터 다시 받아요.
 * refresh는 보던 목록을 비우지 않고 첫 쪽을 조용히 다시 받아서, 관리 작업 뒤에 화면이 깜빡이지 않아요.
 */
export function usePaged<T>(load: (page: number) => Promise<Result<Slice<T>>>, key: string) {
  const [items, setItems] = useState<T[] | null>(null)
  const [next, setNext] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const latest = useRef(load)
  latest.current = load
  const quiet = useRef(false)

  useEffect(() => {
    let stale = false
    if (!quiet.current) setItems(null)
    quiet.current = false
    void latest.current(0).then((result) => {
      if (stale) return
      if (!result.ok) {
        setError(result.message)
        return
      }
      setError('')
      setItems(result.data.items)
      setNext(result.data.hasNext ? 1 : null)
    })
    return () => {
      stale = true
    }
  }, [key, attempt])

  async function more() {
    if (next === null || loadingMore) return
    setLoadingMore(true)
    const result = await latest.current(next)
    setLoadingMore(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setItems((prev) => [...(prev ?? []), ...result.data.items])
    setNext(result.data.hasNext ? next + 1 : null)
  }

  return {
    items,
    error,
    hasNext: next !== null,
    loadingMore,
    more,
    retry: () => {
      setError('')
      setAttempt((value) => value + 1)
    },
    refresh: () => {
      quiet.current = true
      setAttempt((value) => value + 1)
    },
  }
}

export function Failed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mt-16 flex flex-col items-center gap-4 text-center">
      <p className="text-[14px] leading-relaxed text-gray-600">{message}</p>
      <button type="button" onClick={onRetry} className={toolButton}>
        다시 시도하기
      </button>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="mt-16 text-center text-[14px] leading-relaxed text-gray-600">{children}</p>
}

/** 표와 같은 자리에 두는 스켈레톤이에요. */
export function RowsSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div aria-busy="true" className="mt-3 overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <span className="sr-only">불러오고 있어요.</span>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} aria-hidden className="flex h-[57px] items-center gap-6 border-t border-gray-100 px-4 first:border-t-0">
          <div className="min-w-0 flex-1">
            <Bone className={`h-3.5 ${row % 2 ? 'w-32' : 'w-24'}`} />
            <Bone className="mt-2 h-3 w-44" />
          </div>
          <Bone className="h-3 w-16" />
          <Bone className="h-3 w-12" />
          <Bone className="h-3 w-20" />
        </div>
      ))}
    </div>
  )
}

export function MoreButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      className="mt-4 h-9 rounded-full bg-gray-100 px-4 text-[13px] font-medium text-gray-700 transition-colors hover:text-brand disabled:text-gray-400"
    >
      {loading ? '처리 중' : '더 보기'}
    </button>
  )
}

export const tableWrap = 'mt-3 overflow-x-auto rounded-2xl border border-gray-200 bg-white'
export const th = 'px-4 py-2.5 text-left text-[12px] font-medium whitespace-nowrap text-gray-400'
export const td = 'px-4 py-2.5 align-middle'
