import { useEffect, useState } from 'react'
import { DEEP_SECTIONS, type DeepReport, type DeepSection } from '../../shared/types'
import { track } from '../lib/analytics'
import { useAnalysis } from '../hooks/useAnalysis'
import { fetchChat, fetchDeepReport } from '../lib/api'
import { fetchMyChats } from '../lib/auth'
import { formatWhen } from '../lib/format'
import { Chat } from './Chat'
import { MapMenu, toolButton } from './DeepParts'
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
  /** 사이드바에서 채팅을 지우면 값이 바뀌어요. 내 작업을 다시 받아서 갤러리와 채팅 칸을 맞춰요. */
  refreshKey: number
}

const SECTION_LABELS: Record<DeepSection, string> = {
  structure: '프로젝트 구조',
  pipeline: 'CI/CD',
  issues: 'Issues',
  pulls: 'Pull requests',
}

type Loaded = 'loading' | { report: DeepReport } | { error: string }

const SAVED_PREFIX = 'whoisloafing:deep:v3:'

/** 분석한 결과는 이 기기에 저장해 둬요. 다음에 열면 분석하기를 다시 누르지 않아도 바로 보여요. */
function readSaved(repo: string): Partial<Record<DeepSection, Loaded>> {
  const saved: Partial<Record<DeepSection, Loaded>> = {}
  for (const section of DEEP_SECTIONS) {
    try {
      const raw = localStorage.getItem(`${SAVED_PREFIX}${repo.toLowerCase()}:${section}`)
      if (raw) saved[section] = { report: JSON.parse(raw) as DeepReport }
    } catch {
      continue
    }
  }
  return saved
}

function writeSaved(repo: string, section: DeepSection, report: DeepReport) {
  try {
    localStorage.setItem(`${SAVED_PREFIX}${repo.toLowerCase()}:${section}`, JSON.stringify(report))
  } catch {
    // 저장 공간이 모자라면 저장하지 않아요. 화면에는 그대로 보여요.
  }
}

/** 갤러리에 보여줄 레포 하나. 같은 레포를 여러 번 분석했으면 가장 최근 것 하나만 남겨요. */
interface RepoCard {
  repo: string
  updatedAt: string
}

/**
 * 앱에서만 쓰는 심층 분석 화면이에요. 채팅처럼 말풍선이 쌓이지 않고, 레포 하나를 탭으로 나눠 한 화면에서 살펴봐요.
 * 탭은 처음 열 때 한 번만 받아 두고, 다른 탭에 다녀와도 다시 받지 않아요.
 */
export function Deep({ repo, onOpen, onNew, refreshKey }: Props) {
  // 채팅을 지우면 갤러리를 처음부터 다시 받아요.
  if (!repo) return <Gallery key={refreshKey} onOpen={onOpen} onNew={onNew} />
  // 레포가 바뀌면 받아 둔 내용과 보던 탭을 처음으로 되돌려요.
  return <Dashboard key={repo} repo={repo} onOpen={onOpen} refreshKey={refreshKey} />
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
      <div className="flex items-center justify-between gap-4 pt-6">
        <h1 className="text-[22px] leading-snug font-semibold text-gray-900">심층 분석</h1>
        <button type="button" onClick={onNew} className={toolButton}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="size-3.5" aria-hidden="true">
            <path d="M8 3v10M3 8h10" />
          </svg>
          새 분석
        </button>
      </div>

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

/** 채팅으로 이동 버튼에 쓸 채팅을 찾을 때, 내 작업을 이만큼까지만 넘겨 봐요. */
const CHAT_LOOKUP_PAGES = 3

function Dashboard({ repo, onOpen, refreshKey }: { repo: string; onOpen: (repo: string | null) => void; refreshKey: number }) {
  /** 이 레포를 가장 최근에 분석한 채팅. 찾지 못하면 채팅으로 이동 버튼을 숨겨요. */
  const [chatId, setChatId] = useState<string | null>(null)
  /** 오른쪽의 채팅 칸을 열어 뒀는지 */
  const [chatOpen, setChatOpen] = useState(false)

  useEffect(() => {
    let stale = false
    void (async () => {
      for (let page = 0; page < CHAT_LOOKUP_PAGES; page += 1) {
        const result = await fetchMyChats(page)
        if (stale) return
        if (!result.ok) break
        const found = result.data.items.find((chat) => chat.repoName.toLowerCase() === repo.toLowerCase())
        if (found) {
          setChatId(found.id)
          return
        }
        if (!result.data.hasNext) break
      }
      // 채팅을 지워서 더는 없으면 채팅 버튼과 칸을 치워요.
      if (!stale) setChatId(null)
    })()
    return () => {
      stale = true
    }
  }, [repo, refreshKey])

  const [section, setSection] = useState<DeepSection>('structure')
  const [loaded, setLoaded] = useState<Partial<Record<DeepSection, Loaded>>>(() => readSaved(repo))
  const current = loaded[section]

  /** 탭을 받아 와요. 받은 결과는 이 기기에 저장해서, 다음에 열면 기다리지 않고 바로 보여요. */
  async function analyze(target: DeepSection, again = false) {
    if (again) track('deep_analyze', { repo, section: target })
    setLoaded((prev) => ({ ...prev, [target]: 'loading' }))
    const result = await fetchDeepReport(repo, target)
    if ('report' in result) writeSaved(repo, target, result.report)
    setLoaded((prev) => ({ ...prev, [target]: result }))
  }

  // 탭에 들어오면 저장해 둔 결과를 보여주고, 없으면 바로 받아 와요.
  useEffect(() => {
    if (!current) void analyze(section)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, current])

  const [owner, name] = repo.split('/')
  // 받아 온 탭은 옅은 회색 바탕이 여백 없이 탭 아래를 가득 채워요.
  const bleed = current !== undefined && current !== 'loading' && 'report' in current

  return (
    <main className="flex min-h-0 flex-1">
    <div className="flex min-h-0 min-w-0 flex-1 flex-col px-6 pt-14 pb-6 md:px-10">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 pt-4">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            aria-label="레포 고르는 화면으로 돌아가기"
            onClick={() => onOpen(null)}
            className="-ml-2 flex size-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-4" aria-hidden="true">
              <path d="M10 3.5L5.5 8 10 12.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="min-w-0">
            <p className="text-[12px] text-gray-500">{owner}</p>
            <h1 className="truncate text-[20px] leading-tight font-semibold text-gray-900">{name}</h1>
          </div>
        </div>
        {chatId && (
          <button
            type="button"
            aria-pressed={chatOpen}
            onClick={() => {
              track('deep_chat_toggle', { repo, open: !chatOpen })
              setChatOpen((value) => !value)
            }}
            className={`${toolButton} ${chatOpen ? 'border-brand text-brand-hover hover:border-brand hover:text-brand-hover' : ''}`}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" className="size-4" aria-hidden="true">
              <path d="M2.5 4.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H7l-3 2.5V11.5h-.5a1 1 0 0 1-1-1z" />
            </svg>
            채팅
          </button>
        )}
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
        {/* 저장해 둔 결과를 보고 있을 때만, 레포가 바뀌었으면 새로 받을 수 있게 해요. */}
        {current && current !== 'loading' && 'report' in current && (
          <button
            type="button"
            onClick={() => void analyze(section, true)}
            className="mb-1.5 ml-auto h-8 self-end rounded-lg px-3 text-[13px] font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            재분석 요청
          </button>
        )}
      </div>

      <div
        role="tabpanel"
        className={
          bleed
            ? '-mx-6 -mb-6 flex min-h-0 flex-1 flex-col md:-mx-10'
            : 'mt-5 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto xl:flex-row xl:overflow-visible'
        }
      >
        {!current || current === 'loading' ? (
          <Loading />
        ) : 'error' in current ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-[14px] leading-relaxed text-gray-600">{current.error}</p>
            <button
              type="button"
              onClick={() => void analyze(section, true)}
              className="h-9 rounded-full bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              다시 시도하기
            </button>
          </div>
        ) : (
          <Report key={section} report={current.report} name={name} />
        )}
      </div>
    </div>
      {chatOpen && chatId && <SideChat key={chatId} chatId={chatId} onClose={() => setChatOpen(false)} />}
    </main>
  )
}

/**
 * 대시보드 오른쪽에 여는 작은 채팅 칸이에요. 이 레포를 가장 최근에 분석한 채팅을 불러와서, 화면을 옮기지 않고 이어서 질문할 수 있어요.
 * 여기서 주고받은 말풍선도 같은 채팅에 저장돼요.
 */
function SideChat({ chatId, onClose }: { chatId: string; onClose: () => void }) {
  const { messages, busy, paused, send, resume, load, abandon } = useAnalysis()
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')
  const [readOnly, setReadOnly] = useState(false)

  useEffect(() => {
    let stale = false
    void fetchChat(chatId)
      .catch(() => null)
      .then((snapshot) => {
        if (stale) return
        if (!snapshot) {
          setState('missing')
          return
        }
        load(snapshot)
        setReadOnly(snapshot.shared)
        setState('ready')
      })
    return () => {
      stale = true
      // 칸을 닫아도 돌던 분석은 서버가 끝까지 마쳐서 저장해요.
      abandon()
    }
  }, [abandon, chatId, load])

  return (
    <aside className="flex w-[400px] shrink-0 flex-col border-l border-gray-200 bg-white pt-14">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 py-2.5 pr-3 pl-4">
        <h2 className="text-[14px] font-semibold text-gray-900">채팅</h2>
        <button
          type="button"
          aria-label="채팅 닫기"
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-4" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {state === 'loading' ? (
        <div className="space-y-2.5 p-4" aria-busy="true">
          <span className="sr-only">채팅을 불러오고 있어요.</span>
          <div aria-hidden className="h-11 w-2/3 rounded-2xl bg-gray-100 motion-safe:animate-pulse" />
          <div aria-hidden className="h-32 w-full rounded-2xl bg-gray-100 motion-safe:animate-pulse" />
          <div aria-hidden className="h-11 w-1/2 rounded-2xl bg-gray-100 motion-safe:animate-pulse" />
        </div>
      ) : state === 'missing' ? (
        <p className="p-4 text-[13.5px] leading-relaxed text-gray-500">이 채팅을 열 수 없어요.</p>
      ) : (
        <Chat compact messages={messages} busy={busy} paused={paused} readOnly={readOnly} onResume={resume} onSend={send} onHome={onClose} onNewRepo={onClose} />
      )}
    </aside>
  )
}

/**
 * 탭 하나의 내용이에요. 네 탭 모두 옅은 회색 바탕 위에 그림을 올리고, 왼쪽 위에 메뉴를 띄워요.
 * 프로젝트 구조는 맵이 바탕을 통째로 쓰고, 나머지는 흰 카드를 바탕 위에 놓아요.
 */
function Report({ report, name }: { report: DeepReport; name: string }) {
  const [index, setIndex] = useState(0)

  if (report.section === 'structure' && report.structure) {
    return (
      <div className="min-h-0 min-w-0 flex-1">
        <StructureMap name={name} repo={report.repo} root={report.structure} />
      </div>
    )
  }

  const workflows = report.workflows ?? []
  const templates = report.templates ?? []
  const labels = report.labels ?? []
  const picked = Math.min(index, Math.max(0, workflows.length - 1))
  // 워크플로가 여러 개일 때만 고르는 메뉴를 띄워요. 메뉴가 없으면 그 자리를 비워 두지 않아요.
  const menu = report.section === 'pipeline' && workflows.length > 1

  if (workflows.length === 0 && templates.length === 0 && labels.length === 0) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center bg-gray-50 px-6">
        <p className="max-w-md text-center text-[14px] leading-relaxed text-balance text-gray-600">
          <RichText text={report.summary} />
        </p>
      </div>
    )
  }

  return (
    <div className="relative min-h-0 min-w-0 flex-1 bg-gray-50">
      <div className={`h-full overflow-auto px-4 pb-4 ${menu ? 'pt-16' : 'pt-4'}`}>
        {report.section === 'pipeline' ? (
          <Pipeline workflow={workflows[picked]} />
        ) : (
          <Forms kind={report.section === 'issues' ? 'issue' : 'pull'} templates={templates} labels={labels} large />
        )}
      </div>

      {menu && (
        // 스크롤한 내용이 메뉴 뒤로 비치지 않게, 메뉴가 있는 줄에 바탕을 깔아요.
        <div className="absolute inset-x-0 top-0 flex h-16 items-center gap-2 bg-gray-50 px-4">
          <MapMenu
            value={workflows[picked].name}
            groups={[{ items: workflows.map((workflow, item) => ({ label: workflow.name, checked: item === picked, onSelect: () => setIndex(item) })) }]}
          />
        </div>
      )}
    </div>
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
