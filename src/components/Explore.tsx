import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { track } from '../lib/analytics'
import { fetchExplore, type ExploreKind, type ExploreRepo } from '../lib/api'
import { Avatar } from './History'
import { ExploreCardsSkeleton } from './Skeleton'

/** 탐색의 큰 갈래. GitHub는 GitHub 전체에서 인기 있는 레포, 동아리는 IT 연합 동아리와 커뮤니티가 만든 레포예요. */
export type ExploreCategory = 'github' | 'clubs'
type Category = ExploreCategory

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
const PAGE_SIZE = 48

/** 새 분석 화면의 한 줄에 그려 두는 카드 수. 화면 폭에 들어가는 만큼만 보이고 나머지는 잘려요. */
const ROW_SIZE = 8

type Loaded = ExploreRepo[] | 'failed'

// 받은 목록은 화면을 옮겨 다녀도 남게 화면 바깥에 둬요. 새 분석 화면의 한 줄과 탐색 화면이 같은 목록을 나눠 써서, 종류마다 한 번만 받아요.
const cache: Partial<Record<ExploreKind, Loaded>> = {}
const pending = new Set<ExploreKind>()
const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function load(kind: ExploreKind) {
  if (cache[kind] !== undefined || pending.has(kind)) return
  pending.add(kind)
  void fetchExplore(kind).then((repos) => {
    pending.delete(kind)
    cache[kind] = repos && repos.length > 0 ? repos : 'failed'
    listeners.forEach((listener) => listener())
  })
}

function retry(kind: ExploreKind) {
  delete cache[kind]
  listeners.forEach((listener) => listener())
  load(kind)
}

/** 목록 하나를 받아서 돌려줘요. 받는 중이면 undefined예요. enabled가 false면 받지 않아요. */
function useList(kind: ExploreKind, enabled = true): Loaded | undefined {
  const list = useSyncExternalStore(subscribe, () => cache[kind])
  useEffect(() => {
    if (enabled) load(kind)
  }, [kind, enabled, list])
  return list
}

const chip = (active: boolean) =>
  `h-9 shrink-0 rounded-lg border px-3.5 text-[13px] font-medium transition-colors ${active ? 'border-brand text-brand-hover' : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900'}`

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

const cardsGrid = 'grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4'
/** 한 줄만 보여주는 카드 줄. 둘째 줄부터는 높이를 0으로 두고 잘라서, 화면 폭에 들어가는 만큼만 보여요. */
const cardsRow = 'grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] auto-rows-[0px] grid-rows-[auto] gap-x-4 overflow-hidden'

function Card({ item, onOpen }: { item: ExploreRepo; onOpen: (item: ExploreRepo) => void }) {
  const [owner, name] = item.repo.split('/')
  return (
    <li className="min-h-0">
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="flex h-[176px] w-full flex-col rounded-2xl border border-gray-200 bg-white p-5 text-left transition-colors hover:border-brand"
      >
        <span className="flex items-center gap-3">
          <Avatar owner={owner} />
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold text-gray-900">{name}</span>
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
}

function Failed({ onRetry, compact = false }: { onRetry: () => void; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-4 text-center ${compact ? 'py-10' : 'mt-16'}`}>
      <p className="text-[14px] leading-relaxed text-gray-600">목록을 불러오지 못했어요. 잠시 뒤에 다시 시도해 주세요.</p>
      <button type="button" onClick={onRetry} className={primary}>
        다시 시도하기
      </button>
    </div>
  )
}

/** 카드를 누르면 띄우는 확인 창과, 그 창을 여는 함수를 같이 돌려줘요. */
function useAsk(onPick: (repo: string) => void, from: 'home' | 'page') {
  const [asking, setAsking] = useState<{ item: ExploreRepo; kind: ExploreKind } | null>(null)
  const open = (item: ExploreRepo, kind: ExploreKind) => {
    track('explore_repo_open', { repo: item.repo, kind, from })
    setAsking({ item, kind })
  }
  const dialog = asking && (
    <ConfirmDialog
      repo={asking.item}
      onCancel={() => setAsking(null)}
      onConfirm={() => {
        track('explore_repo_select', { repo: asking.item.repo, kind: asking.kind, from })
        onPick(asking.item.repo)
      }}
    />
  )
  return { open, dialog }
}

interface PreviewProps {
  /** 고른 레포(소유자/레포)로 새 분석을 시작해요. */
  onPick: (repo: string) => void
  /** 서버에 연합 동아리와 커뮤니티 목록이 있는지. 없으면 GitHub 줄만 보여줘요. */
  clubs?: boolean
  /** 탐색 화면을 그 갈래로 열어요. */
  onMore: (category: Category) => void
}

/**
 * 앱의 새 분석 화면에서 입력창 아래에 붙는 맛보기예요. GitHub와 연합 동아리 & 커뮤니티를 한 줄씩만 보여주고,
 * 더 둘러보려면 "전체 보기"로 탐색 화면에 가요.
 */
export function ExplorePreview({ onPick, clubs: hasClubs = false, onMore }: PreviewProps) {
  const github = useList('popular')
  const clubRepos = useList('clubs', hasClubs)
  const topClubs = useMemo(
    () => (Array.isArray(clubRepos) ? [...clubRepos].sort(SORTERS.stars).slice(0, ROW_SIZE) : clubRepos),
    [clubRepos],
  )
  const { open, dialog } = useAsk(onPick, 'home')

  const rows: { category: Category; kind: ExploreKind; list: Loaded | undefined }[] = [
    { category: 'github', kind: 'popular', list: Array.isArray(github) ? github.slice(0, ROW_SIZE) : github },
    ...(hasClubs ? [{ category: 'clubs' as const, kind: 'clubs' as const, list: topClubs }] : []),
  ]

  return (
    <div className="flex flex-col gap-9">
      {rows.map(({ category, kind, list }) => (
        <section key={category} aria-labelledby={`explore-${category}`}>
          <div className="flex items-center justify-between gap-4">
            <h2 id={`explore-${category}`} className="text-[15px] font-semibold text-gray-900">
              {CATEGORIES.find(([value]) => value === category)?.[1]}
            </h2>
            <button
              type="button"
              onClick={() => {
                track('explore_more_click', { category })
                onMore(category)
              }}
              className="inline-flex h-8 items-center gap-1 text-[13px] font-medium text-gray-500 transition-colors hover:text-brand"
            >
              전체 보기
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
                <path d="M6 3.5 10.5 8 6 12.5" />
              </svg>
            </button>
          </div>
          {list === undefined ? (
            <ExploreCardsSkeleton row />
          ) : list === 'failed' ? (
            <Failed compact onRetry={() => retry(kind)} />
          ) : (
            <ul className={`mt-3 ${cardsRow}`}>
              {list.map((item) => (
                <Card key={item.repo} item={item} onOpen={(picked) => open(picked, kind)} />
              ))}
            </ul>
          )}
        </section>
      ))}
      {dialog}
    </div>
  )
}

interface Props {
  /** 보고 있는 갈래 */
  category: Category
  onCategory: (category: Category) => void
  /** 고른 레포(소유자/레포)로 새 분석을 시작해요. */
  onPick: (repo: string) => void
  /** 서버에 연합 동아리와 커뮤니티 목록이 있는지. 없으면 갈래를 고르는 버튼 없이 GitHub 목록만 보여줘요. */
  clubs?: boolean
}

/**
 * 앱의 탐색 화면이에요. 공개 레포를 화면 가득 펼쳐 놓고 둘러보다가 눌러서 분석을 시작해요.
 * GitHub에서 인기 있는 레포와, IT 연합 동아리와 커뮤니티가 만든 레포 두 갈래로 나눠서 보여줘요.
 */
export function Explore({ category: wanted, onCategory, onPick, clubs: hasClubs = false }: Props) {
  const category: Category = hasClubs ? wanted : 'github'
  const [githubKind, setGithubKind] = useState<'popular' | 'rising'>('popular')
  const kind: ExploreKind = category === 'clubs' ? 'clubs' : githubKind
  /** 고른 동아리. null이면 모든 동아리의 레포를 한데 모아서 보여줘요. */
  const [club, setClub] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('stars')
  /** 동아리 레포를 몇 개까지 그렸는지. 동아리나 순서를 바꾸면 처음으로 돌아가요. */
  const [shown, setShown] = useState(PAGE_SIZE)
  const loaded = useList(kind)
  const clubRepos = category === 'clubs' && Array.isArray(loaded) ? loaded : null
  // 동아리 레포는 서버가 전부 한꺼번에 보내요. 동아리 이름은 가나다순으로 늘어놓고, 고르기와 순서 바꾸기는 여기서 해요.
  const clubs = useMemo(
    () => (clubRepos ? [...new Set(clubRepos.map((item) => item.club ?? ''))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'ko')) : []),
    [clubRepos],
  )
  const sorted = useMemo(
    () => (clubRepos ? clubRepos.filter((item) => !club || item.club === club).sort(SORTERS[sort]) : []),
    [clubRepos, club, sort],
  )
  const list = clubRepos ? sorted.slice(0, shown) : loaded
  const more = clubRepos ? sorted.length - shown : 0
  const { open, dialog } = useAsk(onPick, 'page')

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="px-6 pt-20 pb-16 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[24px] font-semibold leading-snug text-gray-900 sm:text-[30px]">탐색</h1>
          <div role="radiogroup" aria-label="탐색 갈래" className={hasClubs ? 'inline-flex rounded-xl bg-gray-100 p-1' : 'hidden'}>
            {CATEGORIES.map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={category === value}
                onClick={() => {
                  if (category === value) return
                  track('explore_kind_change', { kind: value === 'clubs' ? 'clubs' : githubKind })
                  onCategory(value)
                }}
                className={`h-9 rounded-lg px-4 text-[14px] font-medium transition-colors ${category === value ? 'bg-white text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 갈래 안에서 한 번 더 골라요. GitHub는 인기와 요즘 뜨는, 동아리는 전체와 동아리 이름이에요. */}
        <div role="radiogroup" aria-label={category === 'clubs' ? '동아리' : '목록 종류'} className="mt-6 flex flex-wrap gap-2">
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

        {clubRepos && sorted.length > 0 && (
          <div className="mt-6 flex items-center justify-between gap-3">
            <p className="text-[13px] text-gray-500 tabular-nums">{sorted.length.toLocaleString('ko-KR')}개의 항목</p>
            <div role="radiogroup" aria-label="순서" className="flex items-center gap-4">
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
        ) : list === 'failed' ? (
          <Failed onRetry={() => retry(kind)} />
        ) : (
          <ul className={`mt-4 ${cardsGrid}`}>
            {list.map((item) => (
              <Card key={item.repo} item={item} onOpen={(picked) => open(picked, kind)} />
            ))}
          </ul>
        )}

        {more > 0 && (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => setShown((prev) => prev + PAGE_SIZE)}
              className="h-10 rounded-full bg-gray-100 px-5 text-[13px] font-medium text-gray-700 transition-colors hover:text-brand"
            >
              더 보기
            </button>
          </div>
        )}
      </div>
      {dialog}
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
