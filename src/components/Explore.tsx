import { useEffect, useState } from 'react'
import { track } from '../lib/analytics'
import { fetchExplore, type ExploreKind, type ExploreRepo } from '../lib/api'
import { Avatar } from './History'

interface Props {
  /** 고른 레포(소유자/레포)로 새 분석을 시작해요. */
  onPick: (repo: string) => void
}

const KINDS: [ExploreKind, string][] = [
  ['popular', '인기'],
  ['rising', '요즘 뜨는'],
]

/** 스타 수를 "12.3만"처럼 짧게 적어요. */
function formatStars(stars: number): string {
  if (stars >= 10000) return `${(stars / 10000).toFixed(1).replace(/\.0$/, '')}만`
  return stars.toLocaleString('ko-KR')
}

/** 스타 수는 글자 대신 GitHub처럼 별 그림과 숫자로 보여줘요. */
function Stars({ count }: { count: number }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1" aria-label={`별 ${count.toLocaleString('ko-KR')}개`}>
      <svg viewBox="0 0 16 16" fill="currentColor" className="size-3" aria-hidden="true">
        <path d="M8 1.2l2 4.3 4.7.6-3.5 3.2.9 4.7L8 11.7 3.9 14l.9-4.7L1.3 6.1 6 5.5z" />
      </svg>
      {formatStars(count)}
    </span>
  )
}

/**
 * 앱의 탐색 화면이에요. 링크를 직접 적지 않아도, GitHub에서 인기 있는 공개 레포를 둘러보다가 눌러서 바로 분석을 시작해요.
 * 목록은 종류마다 처음 볼 때 한 번만 받아요.
 */
export function Explore({ onPick }: Props) {
  const [kind, setKind] = useState<ExploreKind>('popular')
  const [lists, setLists] = useState<Partial<Record<ExploreKind, ExploreRepo[] | 'failed'>>>({})
  const list = lists[kind]
  /** 눌러서 분석할지 물어보고 있는 레포 */
  const [asking, setAsking] = useState<ExploreRepo | null>(null)

  useEffect(() => {
    if (list !== undefined) return
    let stale = false
    void fetchExplore(kind).then((repos) => {
      if (!stale) setLists((prev) => ({ ...prev, [kind]: repos ?? 'failed' }))
    })
    return () => {
      stale = true
    }
  }, [kind, list])

  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-6 pt-14 pb-10 md:px-10">
      <div className="flex flex-wrap items-center justify-between gap-4 pt-6">
        <h1 className="text-[22px] leading-snug font-semibold text-gray-900">탐색</h1>
        <div role="radiogroup" aria-label="목록 종류" className="inline-flex rounded-lg bg-gray-100 p-0.5">
          {KINDS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={kind === value}
              onClick={() => {
                track('explore_kind_change', { kind: value })
                setKind(value)
              }}
              className={`h-8 rounded-md px-3.5 text-[13px] font-medium transition-colors ${kind === value ? 'bg-white text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {list === undefined ? (
        <ul className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3" aria-busy="true">
          <li className="sr-only">불러오고 있어요.</li>
          {Array.from({ length: 12 }, (_, item) => (
            <li key={item} aria-hidden className="h-[168px] rounded-2xl bg-gray-100 motion-safe:animate-pulse" />
          ))}
        </ul>
      ) : list === 'failed' || list.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-4 text-center">
          <p className="text-[14px] leading-relaxed text-gray-600">목록을 불러오지 못했어요. 잠시 뒤에 다시 시도해 주세요.</p>
          <button
            type="button"
            onClick={() => setLists((prev) => ({ ...prev, [kind]: undefined }))}
            className="h-9 rounded-full bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            다시 시도하기
          </button>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
          {list.map((item) => {
            const [owner, name] = item.repo.split('/')
            return (
              <li key={item.repo}>
                <button
                  type="button"
                  onClick={() => {
                    track('explore_repo_open', { repo: item.repo, kind })
                    setAsking(item)
                  }}
                  className="flex h-[168px] w-full flex-col rounded-2xl border border-gray-200 bg-white p-4 text-left transition-colors hover:border-brand"
                >
                  <span className="flex items-center gap-3">
                    <Avatar owner={owner} />
                    <span className="min-w-0">
                      <span className="block truncate text-[14.5px] font-semibold text-gray-900">{name}</span>
                      <span className="block truncate text-[12px] text-gray-400">{owner}</span>
                    </span>
                  </span>
                  <span className="mt-3 line-clamp-2 min-h-0 flex-1 text-[13px] leading-relaxed text-gray-600">{item.description ?? ''}</span>
                  <span className="mt-2 flex items-center justify-between gap-2 text-[12px] text-gray-400 tabular-nums">
                    <span className="min-w-0 truncate">{item.language ?? ''}</span>
                    <Stars count={item.stars} />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {asking && (
        <ConfirmDialog
          repo={asking}
          onCancel={() => setAsking(null)}
          onConfirm={() => {
            track('explore_repo_select', { repo: asking.repo, kind })
            onPick(asking.repo)
          }}
        />
      )}
    </main>
  )
}

const quiet = 'h-9 rounded-full px-3.5 text-[13px] font-medium text-gray-600 transition-colors hover:text-gray-900'
const primary = 'h-9 rounded-full bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover'

/** 카드를 누르면 바로 분석하지 않고, 어떤 레포인지 보여주면서 한 번 물어봐요. 바깥을 누르거나 Esc를 누르면 닫혀요. */
function ConfirmDialog({ repo, onCancel, onConfirm }: { repo: ExploreRepo; onCancel: () => void; onConfirm: () => void }) {
  const [owner, name] = repo.repo.split('/')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/25 px-5 backdrop-blur-[2px]"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div role="alertdialog" aria-modal="true" aria-labelledby="explore-confirm-title" className="w-full max-w-sm animate-rise rounded-2xl border border-gray-200 bg-white p-5">
        <h2 id="explore-confirm-title" className="text-[15px] font-semibold text-gray-900">
          이 프로젝트를 분석할까요?
        </h2>
        <div className="mt-3.5 flex items-center gap-3">
          <Avatar owner={owner} />
          <div className="min-w-0">
            <p className="truncate text-[14.5px] font-semibold text-gray-900">{name}</p>
            <p className="truncate text-[12px] text-gray-400">{owner}</p>
          </div>
        </div>
        {repo.description && <p className="mt-3 text-[13px] leading-relaxed text-gray-600">{repo.description}</p>}
        <p className="mt-2 flex items-center gap-2.5 text-[12px] text-gray-400 tabular-nums">
          {repo.language && <span>{repo.language}</span>}
          <Stars count={repo.stars} />
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={quiet}>
            취소
          </button>
          <button type="button" autoFocus onClick={onConfirm} className={primary}>
            분석하기
          </button>
        </div>
      </div>
    </div>
  )
}
