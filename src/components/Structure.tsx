import { useState } from 'react'
import type { StructureNode } from '../../shared/types'

interface Props {
  root: StructureNode
  /** 크게 보기 창 안이면 true. 폴더를 더 깊이 펼쳐 두고, 폴더에 든 파일 이름도 보여줘요. */
  large: boolean
}

const count = (value: number) => value.toLocaleString('ko-KR')
const share = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0)

/**
 * 프로젝트 구조를 두 가지로 보여줘요.
 * 위의 지도는 최상위 폴더를 칸으로 그려서, 파일이 많은 폴더일수록 칸이 넓어요. 칸을 누르면 아래에 그 폴더만 보여요.
 * 아래의 나무는 폴더마다 맡은 역할과 파일 수를 한 줄로 보여주고, 누르면 하위 폴더가 펼쳐져요.
 */
export function Structure({ root, large }: Props) {
  const [focus, setFocus] = useState<string | null>(null)
  const focused = root.children.find((node) => node.path === focus) ?? null
  const shown = focused ? [focused] : root.children

  if (root.children.length === 0) {
    return <FileChips names={root.samples ?? []} />
  }

  return (
    <div className={large ? 'lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start lg:gap-6' : ''}>
      <div className={large ? 'lg:sticky lg:top-0' : ''}>
        <div className="flex flex-wrap gap-1.5">
          {root.children.map((node) => {
            const selected = node.path === focus
            return (
              <button
                key={node.path}
                type="button"
                aria-pressed={selected}
                onClick={() => setFocus(selected ? null : node.path)}
                // 칸의 너비가 파일 비율을 따라가요. 작은 폴더도 이름이 보이도록 최소 너비는 지켜요.
                style={{ flexBasis: `max(${large ? 132 : 104}px, calc(${share(node.files, root.files)}% - 6px))` }}
                className={`min-w-0 grow rounded-lg px-3 pt-2.5 pb-2 text-left transition-colors ${
                  selected ? 'bg-brand text-white' : 'bg-brand-soft text-gray-900 hover:text-brand-hover'
                }`}
              >
                <span className="block truncate font-mono text-[13px] font-semibold tracking-normal">{node.name}</span>
                <span className={`block truncate text-[12px] ${selected ? 'text-white/70' : 'text-gray-500'}`}>
                  {node.role ?? ' '}
                </span>
                <span className={`mt-1.5 block text-[11px] tabular-nums ${selected ? 'text-white/70' : 'text-gray-500'}`}>
                  파일 {count(node.files)}개, {share(node.files, root.files)}%
                </span>
              </button>
            )
          })}
        </div>
        {root.more && <p className="mt-2 text-[12px] text-gray-400">작은 폴더 {count(root.more)}개는 생략했어요.</p>}
        {root.samples && (
          <div className="mt-3">
            <p className="mb-1.5 text-[12px] text-gray-500">맨 위에 있는 파일</p>
            <FileChips names={root.samples} />
          </div>
        )}
      </div>

      <div className={`mt-4 ${large ? 'lg:mt-0' : 'max-h-80 overflow-y-auto'}`}>
        {focused && (
          <button
            type="button"
            onClick={() => setFocus(null)}
            className="mb-1.5 text-[12px] font-medium text-gray-500 transition-colors hover:text-brand"
          >
            전체 폴더 보기
          </button>
        )}
        <Branch
          // 고른 폴더가 바뀌면 펼친 상태를 처음으로 되돌려요.
          key={focus ?? ''}
          nodes={shown}
          depth={0}
          openDepth={focused ? 2 : large || shown.length <= 3 ? 1 : 0}
          large={large}
        />
      </div>
    </div>
  )
}

function Branch({ nodes, depth, openDepth, large }: { nodes: StructureNode[]; depth: number; openDepth: number; large: boolean }) {
  const max = Math.max(1, ...nodes.map((node) => node.files))
  return (
    <ul className={depth > 0 ? 'ml-[9px] border-l border-gray-200 pl-2' : ''}>
      {nodes.map((node) => (
        <Folder key={node.path} node={node} max={max} depth={depth} openDepth={openDepth} large={large} />
      ))}
    </ul>
  )
}

function Folder({ node, max, depth, openDepth, large }: { node: StructureNode; max: number; depth: number; openDepth: number; large: boolean }) {
  const [open, setOpen] = useState(depth < openDepth)
  const files = large ? (node.samples ?? []) : []
  const expandable = node.children.length > 0 || files.length > 0 || node.more !== undefined

  return (
    <li>
      <button
        type="button"
        disabled={!expandable}
        aria-expanded={expandable ? open : undefined}
        onClick={() => setOpen((value) => !value)}
        className="group flex w-full items-center gap-2 rounded-md py-1.5 pr-1 text-left"
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
          className={`size-3.5 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-90' : ''} ${expandable ? 'group-hover:text-brand' : 'opacity-0'}`}
        >
          <path d="M6 3.5L10.5 8 6 12.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-2.5">
          <span className="block truncate font-mono text-[13px] font-medium tracking-normal text-gray-900 group-hover:text-brand-hover sm:max-w-[60%] sm:shrink-0">
            {node.name}
          </span>
          {node.role && <span className="block truncate text-[12.5px] text-gray-500 sm:min-w-0 sm:flex-1">{node.role}</span>}
        </span>
        {/* 같은 칸에 있는 폴더끼리 파일 수를 견줘 볼 수 있게, 가장 큰 폴더를 기준으로 막대를 그려요. */}
        <span className="h-1.5 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100 sm:w-14" aria-hidden="true">
          <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(6, (node.files / max) * 100)}%` }} />
        </span>
        <span className="w-9 shrink-0 text-right text-[11px] text-gray-500 tabular-nums">{count(node.files)}</span>
      </button>

      {open && expandable && (
        <div className="pb-1">
          {node.children.length > 0 && <Branch nodes={node.children} depth={depth + 1} openDepth={openDepth} large={large} />}
          {(files.length > 0 || node.more !== undefined) && (
            <div className="ml-[9px] border-l border-gray-200 py-1 pl-[26px]">
              <FileChips names={files} />
              {node.more !== undefined && (
                <p className={`text-[12px] text-gray-400 ${files.length > 0 ? 'mt-1.5' : ''}`}>
                  작은 폴더 {count(node.more)}개는 생략했어요.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  )
}

function FileChips({ names }: { names: string[] }) {
  if (names.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1">
      {names.map((name) => (
        <span key={name} className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[11.5px] tracking-normal text-gray-600">
          {name}
        </span>
      ))}
    </div>
  )
}
