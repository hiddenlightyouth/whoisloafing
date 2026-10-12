import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { StructureNode } from '../../shared/types'

interface Props {
  /** 맵 한가운데서 가지가 뻗어 나가는 뿌리 칸에 적을 이름 (레포 이름) */
  name: string
  root: StructureNode
}

const NODE_W = 208
const NODE_H = 50
const COL_GAP = 72
const ROW_GAP = 10
const MIN_ZOOM = 0.3
const MAX_ZOOM = 1.6
/** 이만큼 넘게 움직이면 누른 것이 아니라 끌어서 옮긴 것으로 봐요. */
const DRAG_PX = 4

interface Placed {
  node: StructureNode
  x: number
  y: number
  depth: number
  parent: Placed | null
  /** 서버가 생략한 하위 폴더를 알려 주는 칸이면 그 수 */
  more?: number
}

const count = (value: number) => value.toLocaleString('ko-KR')

/** 펼쳐 둔 폴더만 가로로 뻗는 나무로 자리를 잡아요. 부모는 자식들의 가운데 높이에 와요. */
function layout(root: StructureNode, open: Set<string>): Placed[] {
  const placed: Placed[] = []
  let cursor = 0

  function place(node: StructureNode, depth: number, parent: Placed | null): Placed {
    const item: Placed = { node, x: depth * (NODE_W + COL_GAP), y: 0, depth, parent }
    placed.push(item)
    const expanded = depth === 0 || open.has(node.path)
    const children = expanded ? node.children.map((child) => place(child, depth + 1, item)) : []
    if (expanded && node.more !== undefined && depth > 0) {
      const more: Placed = { node, x: (depth + 1) * (NODE_W + COL_GAP), y: cursor, depth: depth + 1, parent: item, more: node.more }
      cursor += NODE_H + ROW_GAP
      placed.push(more)
      children.push(more)
    }
    if (children.length === 0) {
      item.y = cursor
      cursor += NODE_H + ROW_GAP
    } else {
      item.y = (children[0].y + children[children.length - 1].y) / 2
    }
    return item
  }

  place(root, 0, null)
  return placed
}

/**
 * 프로젝트 구조를 마인드맵처럼 둘러보는 화면이에요.
 * 레포에서 최상위 폴더로, 폴더에서 하위 폴더로 가지가 오른쪽으로 뻗어요. 폴더를 누르면 가지가 펼쳐지고 접혀요.
 * 빈 곳을 끌거나 두 손가락으로 밀면 맵이 움직이고, 두 손가락을 벌리거나 아래 버튼을 누르면 커지고 작아져요.
 */
export function StructureMap({ name, root }: Props) {
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const [selected, setSelected] = useState<string | null>(null)
  const [view, setView] = useState({ x: 24, y: 24, k: 1 })
  const frameRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  /** 방금 끌어서 옮겼으면, 손을 뗄 때 따라오는 클릭을 한 번 무시해요. */
  const suppressClick = useRef(false)
  /** 폴더를 펼치거나 접을 때, 누른 칸이 화면에서 제자리에 있도록 기억해 두는 값 */
  const anchor = useRef<{ key: string; y: number } | null>(null)

  const placed = useMemo(() => layout(root, open), [root, open])
  const keyOf = (item: Placed) => (item.more !== undefined ? `${item.node.path}:more` : item.node.path)
  const width = Math.max(...placed.map((item) => item.x)) + NODE_W
  const height = Math.max(...placed.map((item) => item.y)) + NODE_H

  /** 맵 전체가 화면에 들어오게 맞춰요. 작은 맵을 억지로 키우지는 않아요. */
  const fit = useCallback(() => {
    const frame = frameRef.current
    if (!frame) return
    const pad = 32
    const k = Math.min(1, Math.max(MIN_ZOOM, Math.min((frame.clientWidth - pad * 2) / width, (frame.clientHeight - pad * 2) / height)))
    setView({ k, x: pad, y: Math.max(pad, (frame.clientHeight - height * k) / 2) })
  }, [width, height])

  // 처음 그릴 때 한 번만 화면에 맞춰요. 그 뒤로는 보던 자리를 그대로 둬요.
  const fitted = useRef(false)
  useLayoutEffect(() => {
    if (fitted.current) return
    fitted.current = true
    fit()
  }, [fit])

  // 펼치거나 접으면 다른 칸들의 높이가 바뀌어요. 누른 칸은 화면에서 움직이지 않게 맵을 그만큼 옮겨요.
  useLayoutEffect(() => {
    const kept = anchor.current
    if (!kept) return
    anchor.current = null
    const now = placed.find((item) => keyOf(item) === kept.key)
    if (now && now.y !== kept.y) setView((prev) => ({ ...prev, y: prev.y + (kept.y - now.y) * prev.k }))
  }, [placed])

  const zoomAt = useCallback((factor: number, originX: number, originY: number) => {
    setView((prev) => {
      const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.k * factor))
      const ratio = k / prev.k
      return { k, x: originX - (originX - prev.x) * ratio, y: originY - (originY - prev.y) * ratio }
    })
  }, [])

  // 두 손가락으로 밀면 맵이 움직이고, 벌리면(브라우저가 ctrl과 함께 알려줘요) 커져요. 화면 자체가 밀리지 않게 막아야 해서 직접 붙여요.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      if (event.ctrlKey || event.metaKey) {
        const rect = frame.getBoundingClientRect()
        zoomAt(Math.exp(-event.deltaY * 0.01), event.clientX - rect.left, event.clientY - rect.top)
      } else {
        setView((prev) => ({ ...prev, x: prev.x - event.deltaX, y: prev.y - event.deltaY }))
      }
    }
    frame.addEventListener('wheel', onWheel, { passive: false })
    return () => frame.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    drag.current = { x: event.clientX, y: event.clientY, moved: false }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const state = drag.current
    if (!state) return
    const dx = event.clientX - state.x
    const dy = event.clientY - state.y
    if (!state.moved && Math.hypot(dx, dy) < DRAG_PX) return
    if (!state.moved) event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, y: event.clientY, moved: true }
    setView((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
  }

  function toggle(item: Placed) {
    setSelected(item.node.path)
    if (item.depth === 0 || (item.node.children.length === 0 && item.node.more === undefined)) return
    anchor.current = { key: keyOf(item), y: item.y }
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(item.node.path)) {
        // 접을 때는 그 아래에 펼쳐 둔 폴더도 같이 접어요.
        for (const path of next) if (path === item.node.path || path.startsWith(`${item.node.path}/`)) next.delete(path)
      } else {
        next.add(item.node.path)
      }
      return next
    })
  }

  const focus = placed.find((item) => item.more === undefined && item.node.path === selected && item.depth > 0)
  const zoomBy = (factor: number) => {
    const frame = frameRef.current
    if (frame) zoomAt(factor, frame.clientWidth / 2, frame.clientHeight / 2)
  }

  return (
    <div
      ref={frameRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => {
        // 끌어서 옮긴 직후의 클릭은 칸을 누른 것으로 치지 않아요.
        suppressClick.current = drag.current?.moved === true
        drag.current = null
        if (suppressClick.current) window.setTimeout(() => (suppressClick.current = false), 0)
      }}
      onPointerCancel={() => (drag.current = null)}
      className="relative h-full touch-none overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 select-none"
      style={{ cursor: 'grab' }}
    >
      <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, width, height }}>
        <svg width={width} height={height} className="absolute top-0 left-0 overflow-visible text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          {placed.map((item) => {
            if (!item.parent) return null
            const fromX = item.parent.x + NODE_W
            const fromY = item.parent.y + NODE_H / 2
            const toY = item.y + NODE_H / 2
            const mid = (fromX + item.x) / 2
            return <path key={keyOf(item)} d={`M${fromX} ${fromY} C${mid} ${fromY}, ${mid} ${toY}, ${item.x} ${toY}`} strokeDasharray={item.more !== undefined ? '3 4' : undefined} />
          })}
        </svg>

        {placed.map((item) => {
          const style = { left: item.x, top: item.y, width: NODE_W, height: NODE_H }
          if (item.more !== undefined) {
            return (
              <p key={keyOf(item)} style={style} className="absolute flex items-center rounded-xl border border-dashed border-gray-300 px-3 text-[12px] text-gray-500">
                작은 폴더 {count(item.more)}개 더 있어요
              </p>
            )
          }
          const { node } = item
          const isRoot = item.depth === 0
          const expandable = !isRoot && (node.children.length > 0 || node.more !== undefined)
          const expanded = open.has(node.path)
          const active = selected === node.path && !isRoot
          const total = item.parent?.node.files ?? node.files
          return (
            <button
              key={keyOf(item)}
              type="button"
              style={style}
              aria-expanded={expandable ? expanded : undefined}
              onClick={() => {
                if (!suppressClick.current) toggle(item)
              }}
              className={`absolute flex items-center gap-2 overflow-hidden rounded-xl border pr-2.5 pl-3 text-left transition-colors ${
                isRoot
                  ? 'border-brand bg-brand text-white'
                  : active
                    ? 'border-brand bg-brand-soft text-gray-900'
                    : 'border-gray-200 bg-white text-gray-900 hover:border-brand'
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-[13px] font-semibold tracking-normal">{isRoot ? name : node.name}</span>
                <span className={`block truncate text-[11.5px] ${isRoot ? 'text-white/70' : 'text-gray-500'}`}>
                  {isRoot ? `파일 ${count(node.files)}개` : (node.role ?? `파일 ${count(node.files)}개`)}
                </span>
              </span>
              {!isRoot && (
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[11px] text-gray-500 tabular-nums">{count(node.files)}</span>
                  {expandable && (
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className={`size-3 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true">
                      <path d="M6 3.5L10.5 8 6 12.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
              )}
              {/* 같은 부모 아래에서 이 폴더가 차지하는 비율을 칸 아래의 가는 선으로 보여줘요. */}
              {!isRoot && (
                <span className="absolute bottom-0 left-0 h-[3px] bg-brand" style={{ width: `${Math.max(3, (node.files / Math.max(1, total)) * 100)}%`, opacity: 0.55 }} aria-hidden="true" />
              )}
            </button>
          )
        })}
      </div>

      {focus && (
        <aside
          onPointerDown={(event) => event.stopPropagation()}
          className="absolute bottom-3 left-3 w-64 cursor-default rounded-xl border border-gray-200 bg-white p-3.5 select-text"
        >
          <p className="font-mono text-[12.5px] font-semibold tracking-normal break-all text-gray-900">{focus.node.path}</p>
          {focus.node.role && <p className="mt-1 text-[12.5px] leading-snug text-gray-600">{focus.node.role}</p>}
          <p className="mt-2 text-[12px] text-gray-500 tabular-nums">
            파일 {count(focus.node.files)}개, 전체의 {Math.round((focus.node.files / Math.max(1, root.files)) * 100)}%
          </p>
          {focus.node.samples && (
            <div className="mt-2.5 flex flex-wrap gap-1">
              {focus.node.samples.map((file) => (
                <span key={file} className="max-w-full truncate rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[11.5px] tracking-normal text-gray-600">
                  {file}
                </span>
              ))}
            </div>
          )}
        </aside>
      )}

      <div onPointerDown={(event) => event.stopPropagation()} className="absolute right-3 bottom-3 flex cursor-default items-center gap-1 rounded-full border border-gray-200 bg-white p-1">
        <button type="button" aria-label="작게" onClick={() => zoomBy(1 / 1.25)} className={control}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="size-3.5" aria-hidden="true">
            <path d="M3.5 8h9" />
          </svg>
        </button>
        <span className="w-10 text-center text-[11.5px] text-gray-500 tabular-nums">{Math.round(view.k * 100)}%</span>
        <button type="button" aria-label="크게" onClick={() => zoomBy(1.25)} className={control}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="size-3.5" aria-hidden="true">
            <path d="M3.5 8h9M8 3.5v9" />
          </svg>
        </button>
        <button type="button" onClick={fit} className="h-7 rounded-full px-2.5 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900">
          한눈에 보기
        </button>
      </div>
    </div>
  )
}

const control = 'flex size-7 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900'
