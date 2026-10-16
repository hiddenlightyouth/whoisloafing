import { useEffect, useState } from 'react'
import { DEEP_SECTIONS, type DeepReport, type DeepSection } from '../../shared/types'
import { track } from '../lib/analytics'
import { useAnalysis } from '../hooks/useAnalysis'
import { fetchChat, fetchDeepReport, loadConfig } from '../lib/api'
import { fetchMyChats } from '../lib/auth'
import { useShortcuts } from '../lib/shortcuts'
import { formatDateTime } from '../lib/format'
import { showToast } from '../lib/toast'
import { Chat } from './Chat'
import { ConfirmDialog } from './AdminParts'
import { MapMenu, toolButton } from './DeepParts'
import { Forms } from './Forms'
import { Kbd } from './Shortcuts'
import { Pipeline } from './Pipeline'
import { RepoGallery } from './RepoGallery'
import { RichText } from './RichText'
import { Bone } from './Skeleton'
import { Stack } from './Stack'
import { StructureMap } from './StructureMap'
import { getLang, messages, pick, useLang, useMessages } from '../lib/i18n'

interface Props {
  /** 살펴볼 레포(소유자/레포). null이면 레포를 고르는 화면이에요. */
  repo: string | null
  /** 다른 레포를 열거나(소유자/레포), 레포를 고르는 화면으로 돌아가요(null). */
  onOpen: (repo: string | null) => void
  /** 분석한 레포가 아직 없을 때, 새 분석을 시작하러 가요. */
  onNew: () => void
  /** 사이드바에서 채팅을 지우면 값이 바뀌어요. 내 작업을 다시 받아서 갤러리와 채팅 칸을 맞춰요. */
  refreshKey: number
  /** 채팅에서 넘어왔는지. 그러면 채팅 버튼 아래에 여기서도 채팅을 이어 갈 수 있다고 잠깐 알려줘요. */
  chatHint?: boolean
}

/** 채팅 버튼 아래의 안내를 이만큼 보여주고 치워요. */
const CHAT_HINT_MS = 6000

const TEXT = messages({
  ko: {
    sections: { structure: '프로젝트 구조', pipeline: 'CI/CD', issues: 'Issues', pulls: 'Pull requests', stack: '기술 스택' } as Record<DeepSection, string>,
    title: '심층 분석',
    unchanged: '기존 분석 이후 새로운 변화가 감지되지 않았어요.',
    back: '레포 고르는 화면으로 돌아가기',
    chat: '채팅',
    chatHint: '여기서 채팅을 계속 이용할 수 있어요',
    lastAnalyzed: (when: string) => `마지막 분석 ${when}`,
    reanalyze: '재분석 요청',
    retry: '다시 시도하기',
    reanalyzeTitle: '다시 분석할까요?',
    reanalyzeBody: (section: string) =>
      `${section} 탭을 처음부터 다시 분석해요. 시간이 조금 걸리고, 지금 보고 있는 결과는 새 결과로 바뀌어요. 레포에 새 커밋이 없으면 지금 결과를 그대로 둬요.`,
    closeChat: '채팅 닫기',
    chatLoading: '채팅을 불러오고 있어요.',
    chatFailed: '이 채팅을 열 수 없어요.',
    analyzing: '분석하고 있어요.',
  },
  en: {
    sections: { structure: 'Structure', pipeline: 'CI/CD', issues: 'Issues', pulls: 'Pull requests', stack: 'Tech stack' },
    title: 'Deep dive',
    unchanged: 'No new changes since the last analysis.',
    back: 'Back to repositories',
    chat: 'Chat',
    chatHint: 'You can keep chatting here',
    lastAnalyzed: (when: string) => `Last analyzed ${when}`,
    reanalyze: 'Re-analyze',
    retry: 'Try again',
    reanalyzeTitle: 'Analyze again?',
    reanalyzeBody: (section: string) =>
      `The ${section} tab will be analyzed from scratch. It takes a little while, and the current result will be replaced. If the repo has no new commits, the current result stays as is.`,
    closeChat: 'Close chat',
    chatLoading: 'Loading the chat.',
    chatFailed: 'This chat cannot be opened.',
    analyzing: 'Analyzing.',
  },
})

type Loaded = 'loading' | { report: DeepReport } | { error: string }

const SAVED_PREFIX = 'whoisloafing:deep:v3:'

/** 서버가 언어마다 다른 글을 보내서, 영어로 받은 결과는 따로 저장해요. */
const savedKey = (repo: string, section: DeepSection) => `${SAVED_PREFIX}${repo.toLowerCase()}:${section}${getLang() === 'en' ? ':en' : ''}`

/** 분석한 결과는 이 기기에 저장해 둬요. 다음에 열면 분석하기를 다시 누르지 않아도 바로 보여요. */
function readSaved(repo: string): Partial<Record<DeepSection, Loaded>> {
  const saved: Partial<Record<DeepSection, Loaded>> = {}
  for (const section of DEEP_SECTIONS) {
    try {
      const raw = localStorage.getItem(savedKey(repo, section))
      if (raw) saved[section] = { report: JSON.parse(raw) as DeepReport }
    } catch {
      continue
    }
  }
  return saved
}

function clearPeople(repo: string) {
  try {
    localStorage.removeItem(`whoisloafing:deep:v2:${repo.toLowerCase()}:people`)
  } catch {
    return
  }
}

function writeSaved(repo: string, section: DeepSection, report: DeepReport) {
  try {
    localStorage.setItem(savedKey(repo, section), JSON.stringify(report))
  } catch {
    // 저장 공간이 모자라면 저장하지 않아요. 화면에는 그대로 보여요.
  }
}

/**
 * 앱에서만 쓰는 심층 분석 화면이에요. 채팅처럼 말풍선이 쌓이지 않고, 레포 하나를 탭으로 나눠 한 화면에서 살펴봐요.
 * 탭은 처음 열 때 한 번만 받아 두고, 다른 탭에 다녀와도 다시 받지 않아요.
 */
export function Deep({ repo, onOpen, onNew, refreshKey, chatHint = false }: Props) {
  const L = useMessages(TEXT)
  const lang = useLang()
  // 채팅을 지우면 갤러리를 처음부터 다시 받아요.
  if (!repo) {
    return (
      <RepoGallery
        key={refreshKey}
        title={L.title}
        onNew={onNew}
        onOpen={(picked) => {
          track('deep_repo_select', { repo: picked })
          onOpen(picked)
        }}
      />
    )
  }
  // 레포나 언어가 바뀌면 받아 둔 내용과 보던 탭을 처음으로 되돌려요.
  return <Dashboard key={`${repo}:${lang}`} repo={repo} onOpen={onOpen} refreshKey={refreshKey} chatHint={chatHint} />
}

/** 채팅으로 이동 버튼에 쓸 채팅을 찾을 때, 내 작업을 이만큼까지만 넘겨 봐요. */
const CHAT_LOOKUP_PAGES = 3

function Dashboard({ repo, onOpen, refreshKey, chatHint }: { repo: string; onOpen: (repo: string | null) => void; refreshKey: number; chatHint: boolean }) {
  const L = useMessages(TEXT)
  /** 이 레포를 가장 최근에 분석한 채팅. 찾지 못하면 채팅으로 이동 버튼을 숨겨요. */
  const [chatId, setChatId] = useState<string | null>(null)
  /** 오른쪽의 채팅 칸을 열어 뒀는지 */
  const [chatOpen, setChatOpen] = useState(false)
  /** 서버에 기술 스택 탭이 있는지. 없는 예전 서버에서는 탭을 숨겨요. */
  const [stackReady, setStackReady] = useState(false)
  useEffect(() => {
    void loadConfig().then((config) => setStackReady(config.deepStack))
  }, [])
  const sections = DEEP_SECTIONS.filter((item) => item !== 'stack' || stackReady)
  /** 채팅에서 넘어왔을 때 채팅 버튼 아래에 잠깐 띄우는 안내가 보이는지 */
  const [hinting, setHinting] = useState(chatHint)

  // 채팅 버튼이 나타난 뒤부터 세서, 잠깐 보여주고 치워요. 채팅 칸을 열면 바로 치워요.
  useEffect(() => {
    if (!hinting || !chatId) return
    const timer = window.setTimeout(() => setHinting(false), CHAT_HINT_MS)
    return () => window.clearTimeout(timer)
  }, [hinting, chatId])

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
    const before = loaded[target]
    const kept = before && before !== 'loading' && 'report' in before ? before : null
    setLoaded((prev) => ({ ...prev, [target]: 'loading' }))
    // 받아 둔 결과가 있으면 그때의 상태를 같이 보내서, 그 뒤로 새 커밋이 없으면 다시 분석하지 않아요.
    const result = await fetchDeepReport(repo, target, kept?.report.revision)
    if (kept && 'report' in result && result.report.unchanged) {
      track('deep_analyze_unchanged', { repo, section: target })
      showToast(pick(TEXT).unchanged)
      setLoaded((prev) => ({ ...prev, [target]: kept }))
      return
    }
    // 다시 받지 못했으면 보던 결과를 그대로 둬요.
    if (kept && 'error' in result) {
      showToast(result.error)
      setLoaded((prev) => ({ ...prev, [target]: kept }))
      return
    }
    if ('report' in result) {
      result.report.analyzedAt ??= new Date().toISOString()
      writeSaved(repo, target, result.report)
      // 구조가 바뀌었으면 참여자가 고친 폴더도 다시 받아야 해서, 받아 둔 것을 지워요.
      if (kept && target === 'structure') clearPeople(repo)
    }
    setLoaded((prev) => ({ ...prev, [target]: result }))
  }

  // 탭에 들어오면 저장해 둔 결과를 보여주고, 없으면 바로 받아 와요.
  useEffect(() => {
    if (!current) void analyze(section)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, current])

  const ready = current !== undefined && current !== 'loading' && 'report' in current
  /** 재분석을 요청하기 전에 한 번 더 묻는 창이 떠 있는지 */
  const [asking, setAsking] = useState(false)
  useShortcuts({
    Digit1: () => setSection('structure'),
    Digit2: () => setSection('pipeline'),
    Digit3: () => setSection('issues'),
    Digit4: () => setSection('pulls'),
    Digit5: stackReady ? () => setSection('stack') : undefined,
    // R은 구조 맵의 사각형 도구가 쓰고 있어서, 재분석 요청은 Shift와 같이 눌러요.
    'Shift+KeyR': ready ? () => setAsking(true) : undefined,
    KeyC: chatId ? () => setChatOpen((value) => !value) : undefined,
    // 메뉴나 채팅이 열려 있으면 그것부터 닫고, 아무것도 없을 때 레포 고르는 화면으로 돌아가요.
    Escape: () => {
      if (document.querySelector('[role="menu"]')) return
      if (chatOpen) setChatOpen(false)
      else onOpen(null)
    },
  })

  const [owner, name] = repo.split('/')
  // 받아 온 탭은 옅은 회색 바탕이 여백 없이 탭 아래를 가득 채워요.
  const bleed = !current || current === 'loading' || 'report' in current
  const analyzedAt = current && current !== 'loading' && 'report' in current ? formatDateTime(current.report.analyzedAt) : ''

  return (
    <main className="flex min-h-0 flex-1">
    <div className="flex min-h-0 min-w-0 flex-1 flex-col px-6 pt-14 pb-6 md:px-10">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 pt-4">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            aria-label={L.back}
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
          <div className="relative shrink-0">
            <button
              type="button"
              aria-pressed={chatOpen}
              onClick={() => {
                track('deep_chat_toggle', { repo, open: !chatOpen })
                setHinting(false)
                setChatOpen((value) => !value)
              }}
              className={`relative ${toolButton} ${chatOpen ? 'border-brand! text-brand-hover!' : ''}`}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" className="size-4" aria-hidden="true">
                <path d="M2.5 4.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H7l-3 2.5V11.5h-.5a1 1 0 0 1-1-1z" />
              </svg>
              {L.chat}
              <Kbd corner>C</Kbd>
            </button>
            {hinting && !chatOpen && (
              <p role="status" className="pointer-events-none absolute top-full right-0 z-30 mt-2 origin-top-right animate-pop whitespace-nowrap rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-medium text-white">
                <span aria-hidden className="absolute -top-1 right-6 size-2 rotate-45 bg-brand" />
                {L.chatHint}
              </p>
            )}
          </div>
        )}
      </div>

      <div role="tablist" aria-label={L.title} className="mt-4 flex shrink-0 gap-1 border-b border-gray-200">
        {sections.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={item === section}
            onClick={() => {
              track('deep_section_view', { section: item })
              setSection(item)
            }}
            className={`relative -mb-px h-10 border-b-2 px-3 text-[13.5px] font-medium transition-colors ${
              item === section ? 'border-brand text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            {L.sections[item]}
            <Kbd corner>{String(sections.indexOf(item) + 1)}</Kbd>
          </button>
        ))}
        {/* 저장해 둔 결과를 보고 있을 때만, 레포가 바뀌었으면 새로 받을 수 있게 해요. */}
        {current && current !== 'loading' && 'report' in current && (
          <div className="mb-1.5 ml-auto flex items-center gap-1 self-end">
            {/* 탭마다 따로 분석하니, 지금 보는 탭을 마지막으로 분석한 때를 알려줘요. */}
            {analyzedAt && <span className="text-[12.5px] text-gray-400 tabular-nums">{L.lastAnalyzed(analyzedAt)}</span>}
            <button
              type="button"
              onClick={() => setAsking(true)}
              className="relative flex h-8 items-center rounded-lg px-3 text-[13px] font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              {L.reanalyze}
              <Kbd corner>⇧R</Kbd>
            </button>
          </div>
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
          <Loading section={section} />
        ) : 'error' in current ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-[14px] leading-relaxed text-gray-600">{current.error}</p>
            <button
              type="button"
              onClick={() => void analyze(section, true)}
              className="h-9 rounded-full bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              {L.retry}
            </button>
          </div>
        ) : (
          <Report key={section} report={current.report} name={name} />
        )}
      </div>
    </div>
      {chatOpen && chatId && <SideChat key={chatId} chatId={chatId} onClose={() => setChatOpen(false)} />}
      {asking && (
        <ConfirmDialog
          title={L.reanalyzeTitle}
          body={L.reanalyzeBody(L.sections[section])}
          confirm={L.reanalyze}
          working={false}
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false)
            void analyze(section, true)
          }}
        />
      )}
    </main>
  )
}

/**
 * 대시보드 오른쪽에 여는 작은 채팅 칸이에요. 이 레포를 가장 최근에 분석한 채팅을 불러와서, 화면을 옮기지 않고 이어서 질문할 수 있어요.
 * 여기서 주고받은 말풍선도 같은 채팅에 저장돼요.
 */
function SideChat({ chatId, onClose }: { chatId: string; onClose: () => void }) {
  const L = useMessages(TEXT)
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
    <aside className="flex w-[400px] shrink-0 animate-slide-in flex-col border-l border-gray-200 bg-white pt-14">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 py-2.5 pr-3 pl-4">
        <h2 className="text-[14px] font-semibold text-gray-900">{L.chat}</h2>
        <button
          type="button"
          aria-label={L.closeChat}
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
          <span className="sr-only">{L.chatLoading}</span>
          <div aria-hidden className="h-11 w-2/3 rounded-2xl bg-gray-100 motion-safe:animate-pulse" />
          <div aria-hidden className="h-32 w-full rounded-2xl bg-gray-100 motion-safe:animate-pulse" />
          <div aria-hidden className="h-11 w-1/2 rounded-2xl bg-gray-100 motion-safe:animate-pulse" />
        </div>
      ) : state === 'missing' ? (
        <p className="p-4 text-[13.5px] leading-relaxed text-gray-500">{L.chatFailed}</p>
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

  if (report.section === 'stack' && report.stack) {
    return <Stack groups={report.stack} />
  }

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
        <p className="max-w-md animate-rise text-center text-[14px] leading-relaxed text-balance text-gray-600">
          <RichText text={report.summary} />
        </p>
      </div>
    )
  }

  return (
    <div className="relative min-h-0 min-w-0 flex-1 bg-gray-50">
      <div className={`h-full animate-rise overflow-auto px-4 pb-4 ${menu ? 'pt-16' : 'pt-4'}`}>
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

const card = 'rounded-xl border border-gray-200 bg-white p-5'
/** 옅은 회색 바탕 위에 올라가는 뼈대라 한 단계 진한 회색을 써요. */
const shade = 'rounded-lg bg-gray-200/70 motion-safe:animate-pulse'

/** 맵의 칸 하나만 한 뼈대. 처음 보이는 크기(70%)에 맞췄어요. */
function Node({ left, top }: { left: number; top: number }) {
  return <div className={`absolute h-[35px] w-[146px] ${shade}`} style={{ left, top }} />
}

/**
 * 탭을 받는 동안 보여주는 뼈대예요. 받은 뒤의 화면과 같은 자리에 같은 크기로 둬서, 내용이 들어올 때 화면이 덜 흔들려요.
 * 프로젝트 구조는 가지가 뻗은 맵, CI/CD는 작동 조건과 작업 카드와 원문, Issues와 Pull requests는 양식과 원문 카드 모양이에요.
 */
function Loading({ section }: { section: DeepSection }) {
  const L = useMessages(TEXT)
  if (section === 'structure') {
    return (
      <div className="relative min-h-0 flex-1 overflow-hidden bg-gray-50" aria-busy="true">
        <span className="sr-only">{L.analyzing}</span>
        <div aria-hidden>
          <div className="absolute top-4 left-4 flex gap-2">
            <div className={`h-9 w-[72px] ${shade}`} />
            <div className={`h-9 w-[88px] ${shade}`} />
          </div>
          <div className="absolute top-1/2 left-8">
            <Node left={0} top={-18} />
            {[-132, -88, -44, 0, 44, 88].map((top) => (
              <Node key={top} left={196} top={top} />
            ))}
            {[-154, -110, -66].map((top) => (
              <Node key={top} left={392} top={top} />
            ))}
            {[-22, 22].map((top) => (
              <Node key={top} left={392} top={top} />
            ))}
          </div>
          <div className={`absolute right-4 bottom-4 h-10 w-[218px] ${shade}`} />
        </div>
      </div>
    )
  }

  if (section === 'stack') {
    return (
      <div className="min-h-0 flex-1 overflow-hidden bg-gray-50 p-4" aria-busy="true">
        <span className="sr-only">{L.analyzing}</span>
        <div className="flex flex-wrap items-start gap-x-4 gap-y-8" aria-hidden>
          {[3, 4, 2, 3, 5].map((items, column) => (
            <div key={column} className="w-60">
              <div className="flex h-9 items-center px-1">
                <div className={`h-3 w-16 ${shade}`} />
              </div>
              <div className="space-y-2">
                {Array.from({ length: items }, (_, item) => (
                  <div key={item} className="rounded-xl border border-gray-200 bg-white px-3.5 py-3">
                    <Bone className="h-3.5 w-24" />
                    <Bone className="mt-2 h-3 w-36" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (section === 'pipeline') {
    return (
      <div className="min-h-0 flex-1 overflow-hidden bg-gray-50 p-4" aria-busy="true">
        <span className="sr-only">{L.analyzing}</span>
        <div className="space-y-4" aria-hidden>
          <div className="flex items-center gap-2">
            <div className={`h-4 w-14 ${shade}`} />
            <div className={`h-7 w-32 ${shade}`} />
            <div className={`h-7 w-16 ${shade}`} />
            <div className={`h-7 w-20 ${shade}`} />
          </div>
          <div className="flex gap-6">
            {[5, 7, 3].map((steps, column) => (
              <div key={column} className={`flex-1 ${card}`}>
                <div className="flex items-center gap-2.5">
                  <Bone className="size-6" />
                  <Bone className="h-4 w-2/5" />
                </div>
                <Bone className="mt-3 h-3 w-1/4" />
                <div className="mt-5 space-y-4">
                  {Array.from({ length: steps }, (_, step) => (
                    <div key={step}>
                      <Bone className="h-3.5 w-3/5" />
                      <Bone className="mt-1.5 h-3 w-2/5" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className={card}>
            <div className="flex items-center justify-between">
              <Bone className="h-3.5 w-52" />
              <Bone className="h-9 w-14 rounded-lg" />
            </div>
            <div className="mt-3 h-64 rounded-lg bg-gray-50 motion-safe:animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-hidden bg-gray-50 p-4" aria-busy="true">
      <span className="sr-only">{L.analyzing}</span>
      <div className="space-y-4" aria-hidden>
        {[0, 1].map((row) => (
          <div key={row} className="grid gap-4 lg:grid-cols-2">
            <div className={card}>
              <Bone className="h-4 w-1/3" />
              <Bone className="mt-2 h-3.5 w-1/2" />
              <div className="mt-6 space-y-5">
                {[0, 1, 2].map((field) => (
                  <div key={field}>
                    <Bone className="h-3.5 w-1/4" />
                    <div className="mt-2 h-20 rounded-lg bg-gray-100 motion-safe:animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
            <div className={card}>
              <div className="flex items-center justify-between">
                <Bone className="h-3.5 w-52" />
                <Bone className="h-9 w-14 rounded-lg" />
              </div>
              <div className="mt-3 h-[360px] rounded-lg bg-gray-50 motion-safe:animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
