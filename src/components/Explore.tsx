import { useEffect, useMemo, useState } from 'react'
import { track } from '../lib/analytics'
import { fetchExplore, type ExploreKind, type ExploreRepo } from '../lib/api'
import { Avatar } from './History'
import { MapMenu } from './DeepParts'
import { ExploreCardsSkeleton } from './Skeleton'
import { clubInfo } from '../lib/clubs'
import { readFlag, writeFlag } from '../lib/storage'
import { createStore, useStore } from '../lib/store'
import { moreButton, PageHeader } from './AppPage'
import { primaryButton } from './Dialog'
import { getLang, messages, useMessages, type Lang } from '../lib/i18n'
import { CheckIcon, CloseIcon } from './Icons'

/** 탐색의 큰 갈래. GitHub는 GitHub 전체에서 인기 있는 레포, 동아리는 IT 연합 동아리와 커뮤니티가 만든 레포예요. */
/** clubs는 한국의 연합 동아리와 커뮤니티, global은 해외 학생 개발 동아리와 커뮤니티예요. */
export type ExploreCategory = 'github' | 'clubs' | 'global'
type Category = ExploreCategory

const CATEGORIES: Category[] = ['github', 'clubs', 'global']

/** GitHub 갈래 안에서 고르는 목록 종류 */
const KINDS: ('popular' | 'rising')[] = ['popular', 'rising']

/** 동아리 레포를 늘어놓는 순서 */
type Sort = 'stars' | 'recent' | 'name'

const SORTS: Sort[] = ['stars', 'recent', 'name']

const TEXT = messages({
  ko: {
    categories: { github: 'GitHub', clubs: '연합 동아리 & 커뮤니티', global: '해외 동아리 & 커뮤니티' } as Record<Category, string>,
    kinds: { popular: '인기', rising: '요즘 뜨는' } as Record<'popular' | 'rising', string>,
    sorts: { stars: '스타순', recent: '최근 업데이트순', name: '이름순' } as Record<Sort, string>,
    stars: (count: string) => `별 ${count}개`,
    failed: '목록을 불러오지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
    retry: '다시 시도하기',
    seeAll: '전체 보기',
    title: '탐색',
    tabs: '탐색 갈래',
    clubs: '동아리',
    schools: '학교',
    all: '전체',
    list: '목록',
    sort: '정렬',
    items: (count: string) => `${count}개의 항목`,
    more: '더 보기',
    guide: '동아리를 선택해서 더 자세히 탐색할 수 있어요',
    guideNever: '다시 보지 않기',
    guideClose: '안내 닫기',
    openGithub: (repo: string) => `GitHub에서 ${repo} 열기`,
  },
  en: {
    categories: { github: 'GitHub', clubs: 'Korean clubs & communities', global: 'Student clubs & communities' },
    kinds: { popular: 'Popular', rising: 'Trending' },
    sorts: { stars: 'Most stars', recent: 'Recently updated', name: 'Name' },
    stars: (count: string) => `${count} stars`,
    failed: "Couldn't load the list. Please try again in a moment.",
    retry: 'Try again',
    seeAll: 'See all',
    title: 'Explore',
    tabs: 'Explore categories',
    clubs: 'Clubs',
    schools: 'Chapters',
    all: 'All',
    list: 'List',
    sort: 'Sort',
    items: (count: string) => `${count} ${count === '1' ? 'item' : 'items'}`,
    more: 'Show more',
    guide: 'Pick a club to explore its projects in more detail',
    guideNever: "Don't show again",
    guideClose: 'Close guide',
    openGithub: (repo: string) => `Open ${repo} on GitHub`,
  },
})

/** 숫자를 지금 언어에 맞게 적어요. */
const number = (value: number) => value.toLocaleString(getLang() === 'ko' ? 'ko-KR' : 'en-US')

/** 동아리 목록은 지역마다 달라요. ko는 한국 동아리, en은 해외 학생 개발 동아리와 커뮤니티예요. 화면 언어와 상관없이 갈래로 둘 다 볼 수 있어요. */
const cacheKey = (kind: ExploreKind, region: Lang) => (kind === 'clubs' ? `clubs:${region}` : kind)

/** 동아리 갈래가 받는 지역. GitHub 갈래는 지역이 없어서 아무 값이나 괜찮아요. */
const regionOf = (category: Category): Lang => (category === 'global' ? 'en' : 'ko')

const isClubs = (category: Category) => category !== 'github'


const repoName = (item: ExploreRepo) => item.repo.slice(item.repo.indexOf('/') + 1)

// 레포가 수천 개라 비교할 때마다 로캘을 새로 잡지 않게 정렬기를 하나만 만들어 둬요.
const byKorean = new Intl.Collator('ko').compare

const SORTERS: Record<Sort, (a: ExploreRepo, b: ExploreRepo) => number> = {
  stars: (a, b) => b.stars - a.stars,
  // 시각은 ISO 문자열이라 글자 순서가 곧 시간 순서예요.
  recent: (a, b) => {
    const x = a.pushedAt ?? ''
    const y = b.pushedAt ?? ''
    return x < y ? 1 : x > y ? -1 : 0
  },
  name: (a, b) => byKorean(repoName(a), repoName(b)),
}

/** 동아리 레포는 전부 받아 오니, 한 번에 이만큼만 그리고 더 보기로 이어서 보여줘요. */
const PAGE_SIZE = 48

/** 새 분석 화면의 한 줄에 그려 두는 카드 수. 화면 폭에 들어가는 만큼만 보이고 나머지는 잘려요. */
const ROW_SIZE = 8

type Loaded = ExploreRepo[] | 'failed'

// 받은 목록은 화면을 옮겨 다녀도 남게 화면 바깥에 둬요. 새 분석 화면의 한 줄과 탐색 화면이 같은 목록을 나눠 써서, 종류마다 한 번만 받아요.
const cache = createStore<Partial<Record<string, Loaded>>>({})
const pending = new Set<string>()

const setCached = (key: string, value: Loaded | undefined) => cache.set({ ...cache.get(), [key]: value })

function load(kind: ExploreKind, region: Lang) {
  const key = cacheKey(kind, region)
  if (cache.get()[key] !== undefined || pending.has(key)) return
  pending.add(key)
  void fetchExplore(kind, kind === 'clubs' ? region : getLang()).then((repos) => {
    pending.delete(key)
    setCached(key, repos && repos.length > 0 ? repos : 'failed')
  })
}

function retry(kind: ExploreKind, region: Lang) {
  setCached(cacheKey(kind, region), undefined)
  load(kind, region)
}

/** 목록 하나를 받아서 돌려줘요. 받는 중이면 undefined예요. enabled가 false면 받지 않아요. */
function useList(kind: ExploreKind, region: Lang, enabled = true): Loaded | undefined {
  const list = useStore(cache, (value) => value[cacheKey(kind, region)])
  useEffect(() => {
    if (enabled) load(kind, region)
  }, [kind, region, enabled, list])
  return list
}

/** 스타 수를 "12.3만"처럼 짧게 적어요. */
function formatStars(stars: number): string {
  if (getLang() === 'en') {
    if (stars >= 1000) return `${(stars / 1000).toFixed(1).replace(/\.0$/, '')}k`
    return number(stars)
  }
  if (stars >= 10000) return `${(stars / 10000).toFixed(1).replace(/\.0$/, '')}만`
  return number(stars)
}

/** 스타 수는 글자 대신 GitHub처럼 별 그림과 숫자로 보여줘요. */
function Stars({ count }: { count: number }) {
  const L = useMessages(TEXT)
  return (
    <span className="inline-flex shrink-0 items-center gap-1" aria-label={L.stars(number(count))}>
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

/** 동아리 버튼의 모양. 심층 분석의 버튼과 같은 크기예요. 색은 골랐는지에 따라 따로 붙여요. 같은 속성의 색 클래스를 겹쳐 적으면 어느 쪽이 이길지 알 수 없어서 나눠 둬요. */
const clubButton = 'flex h-9 items-center gap-2 rounded-lg border px-3.5 text-[13px] font-medium transition-colors'

/** 카드는 앞에서부터 조금씩 늦게 떠올라요. 뒤쪽 카드는 더 늦추지 않아요. */
const STAGGER_MS = 28
const STAGGER_MAX = 14

function Card({ item, order, onOpen }: { item: ExploreRepo; order: number; onOpen: (item: ExploreRepo) => void }) {
  const L = useMessages(TEXT)
  const [owner, name] = item.repo.split('/')
  return (
    <li className="group relative min-h-0 animate-rise" style={{ animationDelay: `${Math.min(order, STAGGER_MAX) * STAGGER_MS}ms` }}>
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
      {/* 마우스를 올리면 오른쪽 위에 GitHub로 가는 버튼이 나와요. 터치 화면에서는 늘 보여요. 카드 버튼 안에 넣지 않고 위에 겹쳐 둬요. */}
      <a
        href={`https://github.com/${item.repo}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={L.openGithub(item.repo)}
        title={L.openGithub(item.repo)}
        onClick={() => track('explore_repo_github', { repo: item.repo })}
        className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-900 focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
          <path d="M5 11l6-6M6 5h5v5" />
        </svg>
      </a>
    </li>
  )
}

function Failed({ onRetry, compact = false }: { onRetry: () => void; compact?: boolean }) {
  const L = useMessages(TEXT)
  return (
    <div className={`flex flex-col items-center gap-4 text-center ${compact ? 'py-10' : 'mt-16'}`}>
      <p className="text-[14px] leading-relaxed text-gray-600">{L.failed}</p>
      <button type="button" onClick={onRetry} className={primaryButton}>
        {L.retry}
      </button>
    </div>
  )
}

/** 카드를 누르면 바로 분석하지 않고, 새 분석 화면의 입력창에 그 레포 링크를 넣어 둬요. */
function useAsk(onPick: (repo: string) => void, from: 'home' | 'page') {
  return (item: ExploreRepo, kind: ExploreKind) => {
    track('explore_repo_select', { repo: item.repo, kind, from })
    onPick(item.repo)
  }
}

interface PreviewProps {
  /** 고른 레포(소유자/레포)로 새 분석을 시작해요. */
  onPick: (repo: string) => void
  /** 서버에 연합 동아리와 커뮤니티 목록이 있는지. 없으면 GitHub 줄만 보여줘요. */
  clubs?: boolean
  /** 탐색 화면을 그 갈래로 열어요. */
  onMore: (category: Category) => void
}

/** 동아리 목록에서 스타가 많은 레포를 한 줄만큼 골라요. */
const top = (list: Loaded | undefined) => (Array.isArray(list) ? [...list].sort(SORTERS.stars).slice(0, ROW_SIZE) : list)

/**
 * 앱의 새 분석 화면에서 입력창 아래에 붙는 맛보기예요. GitHub, 연합 동아리 & 커뮤니티, 해외 동아리 & 커뮤니티를 한 줄씩만 보여주고,
 * 더 둘러보려면 "전체 보기"로 탐색 화면에 가요.
 */
export function ExplorePreview({ onPick, clubs: hasClubs = false, onMore }: PreviewProps) {
  const L = useMessages(TEXT)
  const github = useList('popular', 'ko')
  const korean = useList('clubs', 'ko', hasClubs)
  const global = useList('clubs', 'en', hasClubs)
  const topKorean = useMemo(() => top(korean), [korean])
  const topGlobal = useMemo(() => top(global), [global])
  const open = useAsk(onPick, 'home')

  const rows: { category: Category; kind: ExploreKind; list: Loaded | undefined }[] = [
    { category: 'github', kind: 'popular', list: Array.isArray(github) ? github.slice(0, ROW_SIZE) : github },
    ...(hasClubs
      ? [
          { category: 'clubs' as const, kind: 'clubs' as const, list: topKorean },
          { category: 'global' as const, kind: 'clubs' as const, list: topGlobal },
        ]
      : []),
  ]

  return (
    <div className="flex flex-col gap-9">
      {rows.map(({ category, kind, list }) => (
        <section key={category} aria-labelledby={`explore-${category}`}>
          <div className="flex items-center justify-between gap-4">
            <h2 id={`explore-${category}`} className="text-[15px] font-semibold text-gray-900">
              {L.categories[category]}
            </h2>
            <button
              type="button"
              onClick={() => {
                track('explore_more_click', { category })
                onMore(category)
              }}
              className="inline-flex h-8 items-center gap-1 text-[13px] font-medium text-gray-500 transition-colors hover:text-brand"
            >
              {L.seeAll}
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
                <path d="M6 3.5 10.5 8 6 12.5" />
              </svg>
            </button>
          </div>
          {list === undefined ? (
            <ExploreCardsSkeleton row />
          ) : list === 'failed' ? (
            <Failed compact onRetry={() => retry(kind, regionOf(category))} />
          ) : (
            <ul className={`mt-3 ${cardsRow}`}>
              {list.map((item, order) => (
                <Card key={item.repo} item={item} order={order} onOpen={(picked) => open(picked, kind)} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}

const GUIDE_KEY = 'whoisloafing:explore-club-guide-hidden'

/**
 * 동아리 탭에 들어오면 동아리 버튼 줄에 메인 컬러 테두리를 한 바퀴 그리고, 그 아래에 안내 카드를 띄워요.
 * 버튼 줄을 감싼 relative 칸 안에 그려요.
 */
function ClubGuide({ onClose }: { onClose: () => void }) {
  const L = useMessages(TEXT)
  const [never, setNever] = useState(false)
  useEffect(() => track('explore_guide_view'), [])
  return (
    <>
      <svg aria-hidden className="pointer-events-none absolute -top-1.5 -left-1.5 h-[calc(100%+12px)] w-[calc(100%+12px)] overflow-visible text-brand">
        <rect x="0" y="0" width="100%" height="100%" rx="12" fill="currentColor" fillOpacity="0.07" stroke="currentColor" strokeWidth="2.5" pathLength="1" strokeDasharray="1" className="animate-draw" />
      </svg>
      <div
        role="dialog"
        aria-label={L.guide}
        className="absolute top-full left-0 z-20 mt-4 w-[min(340px,calc(100vw-48px))] origin-top-left animate-pop rounded-xl bg-brand p-4 text-white [animation-delay:0.45s]"
      >
        {/* 동아리 버튼 줄을 가리키는 말풍선 꼬리 */}
        <span className="absolute -top-1.5 left-6 size-3 rotate-45 rounded-[2px] bg-brand" aria-hidden="true" />
        <div className="flex items-start gap-3">
          <p className="flex-1 text-[15px] leading-snug font-semibold text-white">{L.guide}</p>
          <button
            type="button"
            aria-label={L.guideClose}
            onClick={() => {
              track('explore_guide_close', { never })
              if (never) writeFlag(GUIDE_KEY, true)
              onClose()
            }}
            className="-mt-1 -mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/15 hover:text-white"
          >
            <CloseIcon className="size-3.5" />
          </button>
        </div>
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-[12.5px] text-white/70 select-none">
          {/* 기본 체크 칸은 파란 바탕에서 색이 어색하고 다크 모드에서 흰색 토큰이 뒤집혀서, 직접 그려요. */}
          <span className="relative flex size-3.5 shrink-0 items-center justify-center">
            <input
              type="checkbox"
              checked={never}
              onChange={(event) => setNever(event.target.checked)}
              className="peer size-3.5 cursor-pointer appearance-none rounded-[4px] border-[1.5px] border-[#ffffff]/70 transition-colors checked:border-[#ffffff] checked:bg-[#ffffff]"
            />
            <CheckIcon className="pointer-events-none absolute size-2.5 text-brand opacity-0 peer-checked:opacity-100" strokeWidth={2.4} />
          </span>
          {L.guideNever}
        </label>
      </div>
    </>
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
  const L = useMessages(TEXT)
  const category: Category = hasClubs ? wanted : 'github'
  const [githubKind, setGithubKind] = useState<'popular' | 'rising'>('popular')
  const kind: ExploreKind = isClubs(category) ? 'clubs' : githubKind
  const region = regionOf(category)
  /** 고른 동아리. null이면 모든 동아리의 레포를 한데 모아서 보여줘요. */
  const [club, setClub] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('stars')
  /** 동아리 레포를 몇 개까지 그렸는지. 동아리나 순서를 바꾸면 처음으로 돌아가요. */
  const [shown, setShown] = useState(PAGE_SIZE)
  const loaded = useList(kind, region)
  const clubRepos = isClubs(category) && Array.isArray(loaded) ? loaded : null
  // 동아리 레포는 서버가 전부 한꺼번에 보내요. 동아리 이름은 가나다순으로 늘어놓고, 고르기와 순서 바꾸기는 여기서 해요.
  const clubs = useMemo(
    () => (clubRepos ? [...new Set(clubRepos.map((item) => item.club ?? ''))].filter(Boolean).sort(byKorean) : []),
    [clubRepos],
  )
  /** 동아리마다 레포가 몇 개인지. 메뉴의 이름 옆에 적어요. */
  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of clubRepos ?? []) if (item.club) map.set(item.club, (map.get(item.club) ?? 0) + 1)
    return map
  }, [clubRepos])
  /** 고른 동아리 안에서 고른 학교. 학교마다 조직이 따로 있는 동아리(멋쟁이사자처럼)에서만 써요. null이면 모든 학교예요. */
  const [group, setGroup] = useState<string | null>(null)
  /** 고른 동아리의 "어떤 단체인가요?" 툴팁이 떠 있는지 */
  const [aboutOpen, setAboutOpen] = useState(false)
  /** 동아리 버튼 줄을 알려주는 안내. 다시 보지 않기를 고르고 닫으면 다음부터 띄우지 않고, 그냥 닫거나 동아리를 고르면 이 화면에서만 닫혀요. */
  const [guide, setGuide] = useState(() => !readFlag(GUIDE_KEY))
  const about = club ? clubInfo(club) : null
  const showAbout = (open: boolean) => {
    if (open && !aboutOpen) track('explore_club_about', { club: club ?? '' })
    setAboutOpen(open)
  }
  /** 고른 동아리의 학교 이름과 학교마다의 레포 수. 가나다순이에요. 학교로 나뉘지 않는 동아리는 비어 있어요. */
  const groups = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of clubRepos ?? []) if (club && item.club === club && item.group) map.set(item.group, (map.get(item.group) ?? 0) + 1)
    return [...map].sort(([a], [b]) => byKorean(a, b))
  }, [clubRepos, club])
  const sorted = useMemo(
    () => (clubRepos ? clubRepos.filter((item) => (!club || item.club === club) && (!club || !group || item.group === group)).sort(SORTERS[sort]) : []),
    [clubRepos, club, group, sort],
  )
  const list = clubRepos ? sorted.slice(0, shown) : loaded
  const more = clubRepos ? sorted.length - shown : 0
  const open = useAsk(onPick, 'page')

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-6 pt-14 md:px-10">
        <PageHeader title={L.title} />
        {/* 심층 분석의 탭과 같은 모양이에요. 갈래가 하나뿐이면 탭을 두지 않아요. */}
        <div role="tablist" aria-label={L.tabs} className={`flex gap-1 border-b border-gray-200 ${hasClubs ? '' : 'h-0 overflow-hidden'}`}>
          {CATEGORIES.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={category === value}
              onClick={() => {
                if (category === value) return
                track('explore_kind_change', { kind: value === 'github' ? githubKind : value })
                setClub(null)
                setGroup(null)
                setShown(PAGE_SIZE)
                onCategory(value)
              }}
              className={`relative -mb-px h-10 border-b-2 px-3 text-[13.5px] font-medium transition-colors ${
                category === value ? 'border-brand text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              {L.categories[value]}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 px-6 pt-4 pb-16 md:px-10">
        {/* 동아리는 메뉴에 넣지 않고 한눈에 보이게 늘어놓아요. */}
        {clubRepos && (
          <div className="relative mb-3">
            <div role="radiogroup" aria-label={L.clubs} className="flex flex-wrap gap-2">
              {[null, ...clubs].map((name) => (
                <button
                  key={name ?? ''}
                  type="button"
                  role="radio"
                  aria-checked={club === name}
                  onClick={() => {
                    track('explore_club_select', { club: name ?? 'all' })
                    setGuide(false)
                    setClub(name)
                    setGroup(null)
                    setShown(PAGE_SIZE)
                  }}
                  className={`${clubButton} ${club === name ? 'border-brand bg-brand-soft text-brand-hover' : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:text-gray-950'}`}
                >
                  {name ?? L.all}
                  <span className={`text-[12px] font-normal tabular-nums ${club === name ? 'text-brand' : 'text-gray-400'}`}>
                    {number(name ? (counts.get(name) ?? 0) : clubRepos.length)}
                  </span>
                </button>
              ))}
            </div>
            {guide && clubs.length > 0 && <ClubGuide onClose={() => setGuide(false)} />}
          </div>
        )}

        {/* 학교마다 조직이 따로 있는 동아리를 고르면, 학교를 한 번 더 고를 수 있어요. */}
        {clubRepos && club && groups.length > 1 && (
          <div role="radiogroup" aria-label={L.schools} className="mb-3 flex animate-rise flex-wrap gap-2">
            {[null, ...groups.map(([name]) => name)].map((name) => (
              <button
                key={name ?? ''}
                type="button"
                role="radio"
                aria-checked={group === name}
                onClick={() => {
                  track('explore_group_select', { club, group: name ?? 'all' })
                  setGroup(name)
                  setShown(PAGE_SIZE)
                }}
                className={`${clubButton} ${group === name ? 'border-brand bg-brand-soft text-brand-hover' : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:text-gray-950'}`}
              >
                {name ?? L.all}
                <span className={`text-[12px] font-normal tabular-nums ${group === name ? 'text-brand' : 'text-gray-400'}`}>
                  {number(name ? (groups.find(([key]) => key === name)?.[1] ?? 0) : (counts.get(club) ?? 0))}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* 낯선 동아리도 있어서, 물음표 줄에 마우스를 올리거나 누르면 어떤 단체인지 툴팁으로 알려줘요. */}
        {clubRepos && about && (
          <div className="relative mb-3 w-fit">
            <button
              type="button"
              aria-expanded={aboutOpen}
              aria-describedby={aboutOpen ? 'explore-club-about' : undefined}
              onMouseEnter={() => showAbout(true)}
              onMouseLeave={() => showAbout(false)}
              onFocus={() => showAbout(true)}
              onBlur={() => showAbout(false)}
              onClick={() => showAbout(!aboutOpen)}
              className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 transition-colors hover:text-gray-700"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
                <circle cx="8" cy="8" r="6.3" />
                <path d="M6.3 6.2a1.75 1.75 0 0 1 3.4.55c0 1.15-1.7 1.5-1.7 2.5" />
                <path d="M8 11.4h.01" strokeWidth="1.8" />
              </svg>
              {about.question}
            </button>
            {aboutOpen && (
              <p
                id="explore-club-about"
                role="tooltip"
                className="absolute top-full left-0 z-20 mt-2 w-max max-w-[min(340px,calc(100vw-48px))] origin-top-left animate-pop rounded-lg bg-gray-900/90 px-3 py-2 text-[12.5px] leading-relaxed text-white"
              >
                {about.answer}
              </p>
            )}
          </div>
        )}

        {/* 목록 종류와 순서는 심층 분석과 같은 드롭다운 메뉴로 골라요. */}
        <div className="flex flex-wrap items-center gap-2">
          {category === 'github' ? (
            <MapMenu
              label={L.list}
              value={L.kinds[githubKind]}
              groups={[
                {
                  items: KINDS.map((value) => ({
                    label: L.kinds[value],
                    checked: githubKind === value,
                    onSelect: () => {
                      track('explore_kind_change', { kind: value })
                      setGithubKind(value)
                    },
                  })),
                },
              ]}
            />
          ) : (
            <>
              <MapMenu
                label={L.sort}
                value={L.sorts[sort]}
                groups={[
                  {
                    items: SORTS.map((value) => ({
                      label: L.sorts[value],
                      checked: sort === value,
                      onSelect: () => {
                        track('explore_sort_change', { sort: value })
                        setSort(value)
                        setShown(PAGE_SIZE)
                      },
                    })),
                  },
                ]}
              />
              {clubRepos && <p className="ml-auto text-[13px] text-gray-500 tabular-nums">{L.items(number(sorted.length))}</p>}
            </>
          )}
        </div>

        {list === undefined ? (
          <ExploreCardsSkeleton />
        ) : list === 'failed' ? (
          <Failed onRetry={() => retry(kind, region)} />
        ) : (
          <ul className={`mt-4 ${cardsGrid}`}>
            {list.map((item, order) => (
              <Card key={`${kind}:${club ?? ''}:${sort}:${item.repo}`} item={item} order={order % PAGE_SIZE} onOpen={(picked) => open(picked, kind)} />
            ))}
          </ul>
        )}

        {more > 0 && (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => setShown((prev) => prev + PAGE_SIZE)}
              className={moreButton}
            >
              {L.more}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
