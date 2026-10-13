import { useEffect, useMemo, useState } from 'react'
import { track } from '../lib/analytics'
import { fetchExplore, type ExploreKind, type ExploreRepo } from '../lib/api'
import { Avatar } from './History'
import { ExploreCardsSkeleton } from './Skeleton'

interface Props {
  /** 고른 레포(소유자/레포)로 새 분석을 시작해요. */
  onPick: (repo: string) => void
  /** 서버에 연합 동아리와 커뮤니티 목록이 있는지. 없으면 갈래를 고르는 버튼 없이 GitHub 목록만 보여줘요. */
  clubs?: boolean
}

/** 탐색의 큰 갈래. GitHub는 GitHub 전체에서 인기 있는 레포, 동아리는 IT 연합 동아리와 커뮤니티가 만든 레포예요. */
type Category = 'github' | 'clubs'

const CATEGORIES: [Category, string][] = [
  ['github', 'GitHub'],
  ['clubs', '연합 동아리 & 커뮤니티'],
]

/** GitHub 갈래 안에서 고르는 목록 종류 */
const KINDS: ['popular' | 'rising', string][] = [
  ['popular', '인기'],
  ['rising', '요즘 뜨는'],
]

/** 동아리 레포를 늘어놓는 순서 */
type Sort = 'stars' | 'recent' | 'name'

const SORTS: [Sort, string][] = [
  ['stars', '스타순'],
  ['recent', '최근 업데이트순'],
  ['name', '이름순'],
]

const repoName = (item: ExploreRepo) => item.repo.slice(item.repo.indexOf('/') + 1)

const SORTERS: Record<Sort, (a: ExploreRepo, b: ExploreRepo) => number> = {
  stars: (a, b) => b.stars - a.stars,
  recent: (a, b) => (b.pushedAt ?? '').localeCompare(a.pushedAt ?? ''),
  name: (a, b) => repoName(a).localeCompare(repoName(b), 'ko'),
}

/** 동아리 레포는 전부 받아 오니, 한 번에 이만큼만 그리고 더 보기로 이어서 보여줘요. */
const PAGE_SIZE = 36

const chip = (active: boolean) =>
  `h-8 shrink-0 rounded-lg border px-3 text-[13px] font-medium transition-colors ${active ? 'border-brand text-brand-hover' : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900'}`

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
 * 앱의 새 분석 화면에서 입력창 아래에 붙는 탐색 목록이에요. 링크를 직접 적지 않아도, 공개 레포를 둘러보다가 눌러서 분석을 시작해요.
 * GitHub에서 인기 있는 레포와, IT 연합 동아리와 커뮤니티가 만든 레포 두 갈래로 나눠서 보여줘요. 목록은 종류마다 처음 볼 때 한 번만 받아요.
 */
export function Explore({ onPick, clubs: hasClubs = false }: Props) {
  const [category, setCategory] = useState<Category>('github')
  const [githubKind, setGithubKind] = useState<'popular' | 'rising'>('popular')
  const kind: ExploreKind = category === 'clubs' ? 'clubs' : githubKind
  /** 고른 동아리. null이면 모든 동아리의 레포를 한데 모아서 보여줘요. */
  const [club, setClub] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('stars')
  /** 동아리 레포를 몇 개까지 그렸는지. 동아리나 순서를 바꾸면 처음으로 돌아가요. */
  const [shown, setShown] = useState(PAGE_SIZE)
  const [lists, setLists] = useState<Partial<Record<ExploreKind, ExploreRepo[] | 'failed'>>>({})
  const loaded = lists[kind]
  // 동아리 레포는 서버가 전부 한꺼번에 보내요. 동아리 이름은 가나다순으로 늘어놓고, 고르기와 순서 바꾸기는 여기서 해요.
  const clubs = useMemo(
    () =>
      Array.isArray(lists.clubs)
        ? [...new Set(lists.clubs.map((item) => item.club ?? ''))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'ko'))
        : [],
    [lists.clubs],
  )
  const sorted = useMemo(
    () =>
      Array.isArray(lists.clubs) ? lists.clubs.filter((item) => !club || item.club === club).sort(SORTERS[sort]) : [],
    [lists.clubs, club, sort],
  )
  const list = kind !== 'clubs' || !Array.isArray(loaded) ? loaded : sorted.slice(0, shown)
  const more = kind === 'clubs' && Array.isArray(loaded) ? sorted.length - shown : 0
  /** 눌러서 분석할지 물어보고 있는 레포 */
  const [asking, setAsking] = useState<ExploreRepo | null>(null)

  useEffect(() => {
    if (loaded !== undefined) return
    let stale = false
    void fetchExplore(kind).then((repos) => {
      if (!stale) setLists((prev) => ({ ...prev, [kind]: repos ?? 'failed' }))
    })
    return () => {
      stale = true
    }
  }, [kind, loaded])

  return (
    <section aria-labelledby="explore-title">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="explore-title" className="text-[15px] font-semibold text-gray-900">
          탐색
        </h2>
        <div role="radiogroup" aria-label="탐색 갈래" className={hasClubs ? 'inline-flex rounded-lg bg-gray-100 p-0.5' : 'hidden'}>
          {CATEGORIES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={category === value}
              onClick={() => {
                if (category === value) return
                track('explore_kind_change', { kind: value === 'clubs' ? 'clubs' : githubKind })
                setCategory(value)
              }}
              className={`h-8 rounded-md px-3.5 text-[13px] font-medium transition-colors ${category === value ? 'bg-white text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 갈래 안에서 한 번 더 골라요. GitHub는 인기와 요즘 뜨는, 동아리는 전체와 동아리 이름이에요. */}
      <div role="radiogroup" aria-label={category === 'clubs' ? '동아리' : '목록 종류'} className="mt-3 flex flex-wrap gap-1.5">
        {category === 'github'
          ? KINDS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={githubKind === value}
                onClick={() => {
                  track('explore_kind_change', { kind: value })
                  setGithubKind(value)
                }}
                className={chip(githubKind === value)}
              >
                {label}
              </button>
            ))
          : [null, ...clubs].map((name) => (
              <button
                key={name ?? ''}
                type="button"
                role="radio"
                aria-checked={club === name}
                onClick={() => {
                  track('explore_club_select', { club: name ?? 'all' })
                  setClub(name)
                  setShown(PAGE_SIZE)
                }}
                className={chip(club === name)}
              >
                {name ?? '전체'}
              </button>
            ))}
      </div>

      {kind === 'clubs' && Array.isArray(loaded) && sorted.length > 0 && (
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-[13px] text-gray-500 tabular-nums">{sorted.length.toLocaleString('ko-KR')}개의 항목</p>
          <div role="radiogroup" aria-label="순서" className="flex items-center gap-3">
            {SORTS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={sort === value}
                onClick={() => {
                  track('explore_sort_change', { sort: value })
                  setSort(value)
                  setShown(PAGE_SIZE)
                }}
                className={`text-[13px] font-medium transition-colors ${sort === value ? 'text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {list === undefined ? (
        <ExploreCardsSkeleton />
      ) : list === 'failed' || list.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-4 text-center">
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
        <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
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
                      <span className="block truncate text-[12px] text-gray-400">{item.club ? `${item.club}, ${owner}` : owner}</span>
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

      {more > 0 && (
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => setShown((prev) => prev + PAGE_SIZE)}
            className="h-9 rounded-full bg-gray-100 px-4 text-[13px] font-medium text-gray-700 transition-colors hover:text-brand"
          >
            더 보기
          </button>
        </div>
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
    </section>
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
