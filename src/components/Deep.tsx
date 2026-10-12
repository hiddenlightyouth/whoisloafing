import { useEffect, useState } from 'react'
import { DEEP_SECTIONS, type DeepReport, type DeepSection } from '../../shared/types'
import { track } from '../lib/analytics'
import { fetchDeepReport } from '../lib/api'
import { fetchMyChats } from '../lib/auth'
import { formatWhen } from '../lib/format'
import { Forms } from './Forms'
import { Avatar } from './History'
import { Pipeline } from './Pipeline'
import { RichText } from './RichText'
import { Bone } from './Skeleton'
import { StructureMap } from './StructureMap'

interface Props {
  /** 살펴볼 레포(소유자/레포). null이면 레포를 고르는 화면이에요. */
  repo: string | null
  /** 다른 레포를 열거나(소유자/레포), 레포를 고르는 화면으로 돌아가요(null). */
  onOpen: (repo: string | null) => void
  /** 분석한 레포가 아직 없을 때, 새 분석을 시작하러 가요. */
  onNew: () => void
}

const SECTION_LABELS: Record<DeepSection, string> = {
  structure: '프로젝트 구조',
  pipeline: 'CI/CD',
  issues: '이슈 템플릿과 라벨',
  pulls: 'PR 템플릿',
}

/** 분석하기를 누르기 전에 탭이 무엇을 보여주는지 알려 주는 말 */
const SECTION_GUIDES: Record<DeepSection, string> = {
  structure: '폴더가 어떻게 나뉘어 있고 각각 무슨 일을 하는지, 맵을 펼쳐 가며 둘러볼 수 있어요.',
  pipeline: '코드를 올리면 어떤 검사와 배포가 어떤 순서로 자동으로 도는지 흐름으로 보여줘요.',
  issues: '이슈를 쓸 때 뜨는 양식과 이 팀이 쓰는 라벨을 실제 화면처럼 보여줘요.',
  pulls: 'PR을 올릴 때 뜨는 양식과, 팀이 그 양식을 얼마나 따르는지 보여줘요.',
}

type Loaded = 'loading' | { report: DeepReport } | { error: string }

/** 갤러리에 보여줄 레포 하나. 같은 레포를 여러 번 분석했으면 가장 최근 것 하나만 남겨요. */
interface RepoCard {
  repo: string
  updatedAt: string
}

/**
 * 앱에서만 쓰는 심층 분석 화면이에요. 채팅처럼 말풍선이 쌓이지 않고, 레포 하나를 탭으로 나눠 한 화면에서 살펴봐요.
 * 탭은 처음 열 때 한 번만 받아 두고, 다른 탭에 다녀와도 다시 받지 않아요.
 */
export function Deep({ repo, onOpen, onNew }: Props) {
  if (!repo) return <Gallery onOpen={onOpen} onNew={onNew} />
  // 레포가 바뀌면 받아 둔 내용과 보던 탭을 처음으로 되돌려요.
  return <Dashboard key={repo} repo={repo} onOpen={onOpen} />
}

/** 링크를 다시 적지 않고, 채팅으로 분석해 둔 레포 중에서 골라요. */
function Gallery({ onOpen, onNew }: { onOpen: (repo: string) => void; onNew: () => void }) {
  const [cards, setCards] = useState<RepoCard[] | null>(null)
  const [nextPage, setNextPage] = useState<number | null>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load(page: number) {
    setLoading(true)
    const result = await fetchMyChats(page)
    setLoading(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setError('')
    setCards((prev) => {
      const seen = new Set((prev ?? []).map((card) => card.repo))
      const added = result.data.items
        .filter((chat) => chat.repoName.includes('/'))
        .map((chat) => ({ repo: chat.repoName, updatedAt: chat.updatedAt }))
        .filter((card) => !seen.has(card.repo) && seen.add(card.repo))
      return [...(prev ?? []), ...added]
    })
    setNextPage(result.data.hasNext ? page + 1 : null)
  }

  useEffect(() => {
    void load(0)
  }, [])

  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-6 pt-14 pb-10 md:px-10">
      <h1 className="pt-6 text-[22px] leading-snug font-semibold text-gray-900">심층 분석</h1>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-gray-500">
        분석해 둔 레포를 고르면 프로젝트 구조, CI/CD, 이슈와 PR 템플릿을 한 화면에서 살펴볼 수 있어요.
      </p>

      {cards === null ? (
        error ? (
          <p className="mt-8 text-[14px] text-gray-500">{error}</p>
        ) : (
          <ul className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3" aria-busy="true">
            <li className="sr-only">불러오고 있어요.</li>
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <li key={item} aria-hidden className="h-[132px] rounded-2xl bg-gray-100 motion-safe:animate-pulse" />
            ))}
          </ul>
        )
      ) : cards.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-4 text-center">
          <p className="text-[14px] leading-relaxed text-gray-600">
            아직 분석한 레포가 없어요.
            <br />
            새 분석으로 레포를 먼저 분석하면 여기에서 고를 수 있어요.
          </p>
          <button type="button" onClick={onNew} className="h-9 rounded-full bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover">
            새 분석 시작하기
          </button>
        </div>
      ) : (
        <>
          <ul className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {cards.map((card) => {
              const [owner, name] = card.repo.split('/')
              return (
                <li key={card.repo}>
                  <button
                    type="button"
                    onClick={() => {
                      track('deep_repo_select', { repo: card.repo })
                      onOpen(card.repo)
                    }}
                    className="flex h-[132px] w-full flex-col justify-between rounded-2xl border border-gray-200 bg-white p-4 text-left transition-colors hover:border-brand"
                  >
                    <Avatar owner={owner} />
                    <span className="min-w-0">
                      <span className="block truncate text-[14.5px] font-semibold text-gray-900">{name}</span>
                      <span className="mt-0.5 flex items-center justify-between gap-2 text-[12px] text-gray-400">
                        <span className="min-w-0 truncate">{owner}</span>
                        <span className="shrink-0">{formatWhen(card.updatedAt)}</span>
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {nextPage !== null && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void load(nextPage)}
              className="mt-4 h-9 rounded-full bg-gray-100 px-4 text-[13px] font-medium text-gray-700 transition-colors hover:text-brand disabled:text-gray-400"
            >
              {loading ? '처리 중' : '더 보기'}
            </button>
          )}
        </>
      )}
    </main>
  )
}

function Dashboard({ repo, onOpen }: { repo: string; onOpen: (repo: string | null) => void }) {
  const [section, setSection] = useState<DeepSection>('structure')
  const [loaded, setLoaded] = useState<Partial<Record<DeepSection, Loaded>>>({})
  const current = loaded[section]

  /** 탭의 분석하기를 눌렀을 때만 받아요. 받아 둔 탭은 다른 탭에 다녀와도 그대로 있어요. */
  async function analyze(target: DeepSection) {
    track('deep_analyze', { repo, section: target })
    setLoaded((prev) => ({ ...prev, [target]: 'loading' }))
    const result = await fetchDeepReport(repo, target)
    setLoaded((prev) => ({ ...prev, [target]: result }))
  }

  const [owner, name] = repo.split('/')

  return (
    <main className="flex min-h-0 flex-1 flex-col px-6 pt-14 pb-6 md:px-10">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-x-6 gap-y-3 pt-4">
        <div className="min-w-0">
          <p className="text-[12px] text-gray-500">{owner}</p>
          <h1 className="truncate text-[20px] leading-tight font-semibold text-gray-900">{name}</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <a
            href={`https://github.com/${repo}`}
            target="_blank"
            rel="noreferrer"
            className="flex h-8 items-center rounded-full px-3 text-[12.5px] font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            GitHub에서 보기
          </a>
          <button
            type="button"
            onClick={() => onOpen(null)}
            className="h-8 rounded-full bg-gray-100 px-3.5 text-[12.5px] font-medium text-gray-700 transition-colors hover:text-brand"
          >
            다른 레포 고르기
          </button>
        </div>
      </div>

      <div role="tablist" aria-label="심층 분석" className="mt-4 flex shrink-0 gap-1 border-b border-gray-200">
        {DEEP_SECTIONS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={item === section}
            onClick={() => {
              track('deep_section_view', { section: item })
              setSection(item)
            }}
            className={`-mb-px h-10 border-b-2 px-3 text-[13.5px] font-medium transition-colors ${
              item === section ? 'border-brand text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            {SECTION_LABELS[item]}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="mt-5 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto xl:flex-row xl:overflow-visible">
        {!current ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div>
              <h2 className="text-[17px] font-semibold text-gray-900">{SECTION_LABELS[section]}</h2>
              <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-balance break-keep text-gray-500">{SECTION_GUIDES[section]}</p>
            </div>
            <button
              type="button"
              onClick={() => void analyze(section)}
              className="h-10 rounded-full bg-brand px-5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              분석하기
            </button>
          </div>
        ) : current === 'loading' ? (
          <Loading />
        ) : 'error' in current ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-[14px] leading-relaxed text-gray-600">{current.error}</p>
            <button
              type="button"
              onClick={() => void analyze(section)}
              className="h-9 rounded-full bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              다시 시도하기
            </button>
          </div>
        ) : (
          <Report report={current.report} name={name} />
        )}
      </div>
    </main>
  )
}

/** 왼쪽에는 해설과 숫자를, 오른쪽에는 그림을 둬요. 좁은 창에서는 위아래로 쌓아요. */
function Report({ report, name }: { report: DeepReport; name: string }) {
  const hasStructure = report.section === 'structure' && report.structure !== undefined
  const hasWorkflows = (report.workflows?.length ?? 0) > 0
  const hasForms = (report.templates?.length ?? 0) > 0 || (report.labels?.length ?? 0) > 0

  return (
    <>
      <aside className="shrink-0 xl:w-80 xl:overflow-y-auto">
        <p className="text-[14.5px] leading-relaxed whitespace-pre-line text-gray-900">
          <RichText text={report.summary} />
        </p>
        {report.facts.length > 0 && (
          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
            {report.facts.map((fact) => (
              <div key={fact.label} className="rounded-xl bg-gray-50 px-3.5 py-3">
                <dt className="text-[12px] text-gray-500">{fact.label}</dt>
                <dd className="mt-1 text-[14px] leading-snug font-semibold break-words text-gray-900 tabular-nums">{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </aside>

      {hasStructure && report.structure && (
        <div className="h-[520px] min-w-0 shrink-0 xl:h-auto xl:flex-1 xl:shrink">
          <StructureMap name={name} root={report.structure} />
        </div>
      )}
      {hasWorkflows && report.workflows && (
        <div className="min-w-0 rounded-2xl border border-gray-200 p-5 xl:flex-1 xl:overflow-y-auto">
          <Pipeline workflows={report.workflows} large />
        </div>
      )}
      {(report.section === 'issues' || report.section === 'pulls') && hasForms && (
        <div className="min-w-0 rounded-2xl border border-gray-200 p-5 xl:flex-1 xl:overflow-y-auto">
          <Forms kind={report.section === 'issues' ? 'issue' : 'pull'} templates={report.templates ?? []} labels={report.labels} large />
        </div>
      )}
    </>
  )
}

function Loading() {
  return (
    <>
      <span className="sr-only">분석하고 있어요.</span>
      <div className="shrink-0 space-y-2.5 xl:w-80" aria-hidden>
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-11/12" />
        <Bone className="h-4 w-2/3" />
        <div className="grid grid-cols-2 gap-2 pt-3">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-[68px] rounded-xl bg-gray-100 motion-safe:animate-pulse" />
          ))}
        </div>
      </div>
      <div className="min-h-[420px] flex-1 rounded-2xl bg-gray-100 motion-safe:animate-pulse" aria-hidden />
    </>
  )
}
