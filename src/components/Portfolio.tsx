import { Marked } from 'marked'
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { track } from '../lib/analytics'
import { useAuth } from '../lib/auth'
import {
  clearPortfolio,
  createPortfolio,
  fetchPortfolioRepos,
  DEFAULT_SECTIONS,
  fetchPortfolioPeople,
  loadPortfolio,
  portfolioSections,
  readPortfolio,
  revisePortfolio,
  revisions,
  toMarkdown,
  writePortfolio,
  type PortfolioKey,
  type PortfolioPerson,
  type PortfolioSection,
  type RevisionKey,
  type SavedPortfolio,
} from '../lib/portfolio'
import { showToast } from '../lib/toast'
import { canvas, CloseIcon, copyRich, copyText, ExportMenu, ghostButton, iconButton, pageFrame, PageHeader, paper, PlanField, RefreshIcon, RevisionPicker, StepLayout, Steps, StepTitle, TrashIcon } from './AppPage'
import { ConfirmDialog, primaryButton } from './Dialog'
import { MapMenu, toolButton } from './DeepParts'
import { RepoGallery } from './RepoGallery'
import { Bone } from './Skeleton'
import { ModelMenu } from './ModelMenu'
import { messages, useMessages } from '../lib/i18n'

interface Props {
  /** 포트폴리오를 만들 레포(소유자/레포). null이면 레포를 고르는 화면이에요. */
  repo: string | null
  onOpen: (repo: string | null) => void
  onNew: () => void
  refreshKey: number
}

/** 기획안은 이만큼까지만 받아요. 서버도 같은 길이로 막아요. */
const PLAN_MAX = 8000

/**
 * 앱에서만 쓰는 포트폴리오 만들기 화면이에요. 분석해 둔 레포를 고르면 항목, 기획안, 내가 누구인지를 차례로 정하고,
 * 만든 뒤에는 왼쪽에서 항목의 순서를 바꾸고 고치며 오른쪽에서 마크다운 미리보기를 봐요.
 */
export function Portfolio({ repo, onOpen, onNew, refreshKey }: Props) {
  const L = useMessages(TEXT)
  const [created, setCreated] = useState<Set<string>>()

  // 갤러리로 돌아올 때마다 다시 받아서, 방금 만들거나 지운 것도 바로 맞춰요.
  useEffect(() => {
    if (repo) return
    let alive = true
    void fetchPortfolioRepos().then((repos) => alive && setCreated(repos))
    return () => {
      alive = false
    }
  }, [repo, refreshKey])

  if (!repo) {
    return (
      <RepoGallery
        key={refreshKey}
        title={L.title}
        created={created}
        onNew={onNew}
        onOpen={(picked) => {
          track('portfolio_repo_select', { repo: picked })
          onOpen(picked)
        }}
      />
    )
  }
  return <Builder key={repo} repo={repo} onBack={() => onOpen(null)} />
}

function Builder({ repo, onBack }: { repo: string; onBack: () => void }) {
  const L = useMessages(TEXT)
  const account = useAuth().me?.email ?? null
  // 이 기기에 남은 것이 있으면 먼저 보여주고, 계정에 저장한 것을 받으면 바꿔요.
  const [saved, setSaved] = useState<SavedPortfolio | null>(() => readPortfolio(repo))
  const [loading, setLoading] = useState(saved === null)
  const [owner, name] = repo.split('/')
  /** 다시 만들기를 누르기 전에 한 번 더 묻는 창이 떠 있는지 */
  const [restarting, setRestarting] = useState(false)
  /** 지우기를 누르기 전에 한 번 더 묻는 창이 떠 있는지 */
  const [deleting, setDeleting] = useState(false)
  /** 받는 사이에 고쳤으면 받은 것으로 덮지 않아요. */
  const touched = useRef(false)

  useEffect(() => {
    let alive = true
    touched.current = false
    void loadPortfolio(repo).then((next) => {
      if (!alive) return
      if (!touched.current) setSaved(next)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [repo, account])

  function save(next: SavedPortfolio) {
    touched.current = true
    writePortfolio(next)
    setSaved(next)
  }

  return (
    <main className={pageFrame}>
      <PageHeader
        owner={owner}
        title={name}
        onBack={onBack}
        backLabel={L.back}
        actions={
          saved && (
            <>
              <button type="button" onClick={() => setDeleting(true)} className={`${toolButton} whitespace-nowrap text-red-500!`}>
                <TrashIcon />
                {L.delete}
              </button>
              <button type="button" onClick={() => setRestarting(true)} className={`${toolButton} whitespace-nowrap`}>
                <RefreshIcon />
                {L.restart}
              </button>
              <ExportMenu
                items={[
                  {
                    label: L.copyRich,
                    run: async () => {
                      const ok = await copyRich(toHtml(name, saved.sections), toMarkdown(name, saved.sections))
                      track('portfolio_copy', { repo, format: 'rich', success: ok })
                      return ok
                    },
                  },
                  {
                    label: L.copy,
                    run: async () => {
                      const ok = await copyText(toMarkdown(name, saved.sections))
                      track('portfolio_copy', { repo, format: 'markdown', success: ok })
                      return ok
                    },
                  },
                ]}
              />
            </>
          )
        }
      />

      {saved ? <Editor saved={saved} name={name} onChange={save} /> : loading ? <Writing quiet /> : <Setup repo={repo} onDone={save} />}

      {restarting && (
        <ConfirmDialog
          title={L.restartTitle}
          body={L.restartBody}
          confirm={L.restartConfirm}
          danger
          working={false}
          onCancel={() => setRestarting(false)}
          onConfirm={() => {
            track('portfolio_restart', { repo })
            touched.current = true
            clearPortfolio(repo)
            setSaved(null)
            setRestarting(false)
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={L.deleteTitle}
          body={L.deleteBody(name)}
          confirm={L.delete}
          danger
          onCancel={() => setDeleting(false)}
          onConfirm={() => {
            track('portfolio_delete', { repo })
            touched.current = true
            clearPortfolio(repo)
            setDeleting(false)
            onBack()
          }}
        />
      )}
    </main>
  )
}

type Step = 'sections' | 'plan' | 'person'

const TEXT = messages({
  ko: {
    title: '포트폴리오 만들기',
    back: '레포 고르는 화면으로 돌아가기',
    restart: '재생성',
    restartTitle: '포트폴리오를 재생성할까요?',
    restartBody: '항목과 기획안부터 다시 골라서 새로 써요. 지금 포트폴리오는 지워지고 되돌릴 수 없어요.',
    restartConfirm: '재생성',
    delete: '삭제',
    deleteTitle: '포트폴리오를 삭제할까요?',
    deleteBody: (name: string) => `${name} 포트폴리오를 삭제해요. 계정에서도 지워지고 되돌릴 수 없어요.`,
    steps: { sections: '항목 선택', plan: '추가 정보', person: '대상 선택' } as Record<Step, string>,
    sectionsTitle: '어떤 항목으로 포트폴리오를 만들까요?',
    planTitle: '참고할 기획안이 있나요?',
    planHint: '기획 배경과 목적은 기획안을 참고해서 써요. 없으면 비워 두고 넘어가도 괜찮아요.',
    planPlaceholder: '기획안이나 서비스 소개 글을 붙여 넣어 주세요',
    personTitle: '참여자 중에서 나를 골라 주세요',
    personHint: '고른 참여자의 커밋과 PR을 보고 맡은 역할을 정리해요.',
    prev: '이전',
    create: '포트폴리오 만들기',
    skip: '건너뛰기',
    next: '다음',
    loading: '불러오는 중이에요.',
    retry: '다시 시도하기',
    noPeople: '아직 커밋한 사람이 없는 레포예요.',
    commits: (count: number) => `커밋 ${count.toLocaleString()}개`,
    peopleLabel: '참여자 목록',
    writing: '포트폴리오를 쓰고 있어요.',
    writingLong: '포트폴리오를 쓰고 있어요. 1분쯤 걸려요.',
    sections: '항목',
    add: '항목 추가',
    removeTitle: '이 항목을 뺄까요?',
    removeBody: (title: string) => `포트폴리오에서 ${title} 항목을 빼요. 나중에 항목 추가로 다시 넣으면 처음부터 새로 써요.`,
    removeConfirm: '빼기',
    copy: '마크다운 복사',
    copyRich: '서식 복사',
    empty: '항목 추가를 눌러 포트폴리오에 넣을 항목을 골라 주세요.',
    reorder: (title: string) => `${title} 순서 바꾸기. 위아래 방향키로 옮길 수 있어요`,
    revising: '다듬고 있어요',
    pending: '쓰고 있어요',
    revise: '다듬기',
    remove: (title: string) => `${title} 항목 빼기`,
    reviseTitle: '어떻게 다듬을까요?',
  },
  en: {
    title: 'Build a portfolio',
    back: 'Back to repositories',
    restart: 'Regenerate',
    restartTitle: 'Regenerate this portfolio?',
    restartBody: 'You will pick sections and a plan again and write it from scratch. The current portfolio will be deleted and cannot be restored.',
    restartConfirm: 'Regenerate',
    delete: 'Delete',
    deleteTitle: 'Delete this portfolio?',
    deleteBody: (name: string) => `The ${name} portfolio will be deleted from your account. This cannot be undone.`,
    steps: { sections: 'Sections', plan: 'Additional info', person: 'Select person' },
    sectionsTitle: 'Which sections should your portfolio have?',
    planTitle: 'Do you have a plan to reference?',
    planHint: 'Background and goals are taken from your plan. You can leave it empty and move on.',
    planPlaceholder: 'Paste a project plan or a description of the service',
    personTitle: 'Who are you in this project?',
    personHint: 'Your role is written from this person\'s commits and PRs.',
    prev: 'Back',
    create: 'Build portfolio',
    skip: 'Skip',
    next: 'Next',
    loading: 'Loading.',
    retry: 'Try again',
    noPeople: 'No one has committed to this repo yet.',
    commits: (count: number) => `${count.toLocaleString()} ${count === 1 ? 'commit' : 'commits'}`,
    peopleLabel: 'Who are you?',
    writing: 'Writing your portfolio.',
    writingLong: 'Writing your portfolio. This takes about a minute.',
    sections: 'Sections',
    add: 'Add section',
    removeTitle: 'Remove this section?',
    removeBody: (title: string) => `${title} will be removed from the portfolio. If you add it back, it will be written again.`,
    removeConfirm: 'Remove',
    copy: 'Copy Markdown',
    copyRich: 'Copy with formatting',
    empty: 'Use Add section to choose what goes into your portfolio.',
    reorder: (title: string) => `Reorder ${title}. Use the up and down arrow keys`,
    revising: 'Revising',
    pending: 'Writing',
    revise: 'Revise',
    remove: (title: string) => `Remove ${title}`,
    reviseTitle: 'What should change?',
  },
})

const STEPS: { key: Step }[] = [{ key: 'sections' }, { key: 'plan' }, { key: 'person' }]

/** 항목, 기획안, 내가 누구인지를 차례로 정하고 포트폴리오를 만들어요. */
function Setup({ repo, onDone }: { repo: string; onDone: (saved: SavedPortfolio) => void }) {
  const L = useMessages(TEXT)
  const [step, setStep] = useState<Step>('sections')
  const [picked, setPicked] = useState<PortfolioKey[]>(DEFAULT_SECTIONS)
  const [plan, setPlan] = useState('')
  const [person, setPerson] = useState<string | null>(null)
  const [people, setPeople] = useState<PortfolioPerson[] | 'loading' | { error: string } | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  async function loadPeople() {
    setPeople('loading')
    const result = await fetchPortfolioPeople(repo)
    setPeople('data' in result ? result.data : { error: result.error })
  }

  // 참여자는 그 단계에 처음 들어왔을 때 받아요. 커밋 기록을 읽느라 시간이 조금 걸려요.
  useEffect(() => {
    if (step === 'person' && people === null) void loadPeople()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  async function create() {
    // 고른 항목은 처음에 늘어놓은 순서대로 써요. 순서는 만든 뒤에 끌어서 바꿔요.
    const sections = portfolioSections().map((item) => item.key).filter((key) => picked.includes(key))
    setWorking(true)
    setError('')
    const result = await createPortfolio(repo, sections, plan.trim(), person)
    setWorking(false)
    track('portfolio_create', { repo, sections: sections.length, plan: plan.trim().length > 0, person: person !== null, success: 'data' in result })
    if ('error' in result) {
      setError(result.error)
      return
    }
    onDone({
      repo,
      sections: result.data.sections.filter((section) => section.content.trim()),
      plan: plan.trim(),
      person,
      createdAt: new Date().toISOString(),
    })
  }

  if (working) return <Writing />

  const index = STEPS.findIndex((item) => item.key === step)
  const last = index === STEPS.length - 1

  return (
    <StepLayout
      top={
        <Steps
          steps={STEPS.map((item) => ({ key: item.key, label: L.steps[item.key], disabled: item.key !== 'sections' && picked.length === 0 }))}
          current={step}
          onSelect={setStep}
        />
      }
      error={error}
      buttons={
        <>
          {last && <ModelMenu up />}
          {index > 0 && (
            <button type="button" onClick={() => setStep(STEPS[index - 1].key)} className={toolButton}>
              {L.prev}
            </button>
          )}
          <button
            type="button"
            // 마지막 단계에서는 나를 골라야 만들 수 있어요.
            disabled={picked.length === 0 || (last && person === null)}
            onClick={() => (last ? void create() : setStep(STEPS[index + 1].key))}
            className={primaryButton}
          >
            {last ? L.create : step === 'plan' && !plan.trim() ? L.skip : L.next}
          </button>
        </>
      }
    >
      <div key={step} className="animate-rise">
        {step === 'sections' ? (
          <>
            <StepTitle title={L.sectionsTitle} />
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {portfolioSections().map((item) => {
                const on = picked.includes(item.key)
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => setPicked((prev) => (on ? prev.filter((key) => key !== item.key) : [...prev, item.key]))}
                      className={`flex w-full items-start gap-3 rounded-xl border bg-white p-3.5 text-left transition-colors ${
                        on ? 'border-brand' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Check on={on} />
                      <span className="min-w-0">
                        <span className="block text-[14px] font-semibold text-gray-900">{item.title}</span>
                        <span className="mt-0.5 block text-[12.5px] text-gray-500">{item.hint}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        ) : step === 'plan' ? (
          <>
            <StepTitle title={L.planTitle} hint={L.planHint} />
            <PlanField value={plan} max={PLAN_MAX} placeholder={L.planPlaceholder} onChange={setPlan} />
          </>
        ) : (
          <>
            <StepTitle title={L.personTitle} hint={L.personHint} />
            <PeopleList people={people} person={person} onPick={setPerson} onRetry={() => void loadPeople()} />
          </>
        )}
      </div>
    </StepLayout>
  )
}

function Check({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
        on ? 'border-brand bg-brand text-white' : 'border-gray-300 bg-white text-transparent'
      }`}
    >
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-3">
        <path d="M2.5 6.2 5 8.5l4.5-5" />
      </svg>
    </span>
  )
}

export function PeopleList({ people, person, onPick, onRetry }: {
  people: PortfolioPerson[] | 'loading' | { error: string } | null
  person: string | null
  onPick: (id: string) => void
  onRetry: () => void
}) {
  const L = useMessages(TEXT)
  if (people === null || people === 'loading') {
    return (
      <ul className="mt-5 grid gap-2" aria-busy="true">
        <li className="sr-only">{L.loading}</li>
        {[0, 1, 2, 3].map((item) => (
          <li key={item} aria-hidden className="flex h-[60px] items-center gap-3 rounded-xl border border-gray-200 bg-white px-3.5">
            <Bone className="size-8 rounded-full" />
            <Bone className="h-4 w-32" />
          </li>
        ))}
      </ul>
    )
  }
  if (!Array.isArray(people)) {
    return (
      <div className="mt-8 flex flex-col items-center gap-4 text-center">
        <p className="text-[14px] text-gray-600">{people.error}</p>
        <button type="button" onClick={onRetry} className={primaryButton}>
          {L.retry}
        </button>
      </div>
    )
  }

  if (people.length === 0) {
    return <p className="mt-8 text-center text-[14px] text-gray-600">{L.noPeople}</p>
  }

  const options = people.map((item) => ({
    id: item.id,
    name: item.name,
    detail: `${item.login ? `@${item.login}, ` : ''}${L.commits(item.commits)}`,
    avatarUrl: item.avatarUrl,
  }))

  return (
    <ul className="mt-5 grid gap-2" role="radiogroup" aria-label={L.peopleLabel}>
      {options.map((item) => {
        const on = person === item.id
        return (
          <li key={item.id}>
            <button
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onPick(item.id)}
              className={`flex h-[60px] w-full items-center gap-3 rounded-xl border bg-white px-3.5 text-left transition-colors ${
                on ? 'border-brand' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {item.avatarUrl ? (
                <img src={item.avatarUrl} alt="" width={32} height={32} className="size-8 shrink-0 rounded-full bg-gray-100" />
              ) : (
                <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[13px] font-semibold text-gray-500">
                  {(item.name[0] ?? '?').toUpperCase()}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-gray-900">{item.name}</span>
                <span className="block truncate text-[12.5px] text-gray-500">{item.detail}</span>
              </span>
              <span
                aria-hidden
                className={`flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-colors ${on ? 'border-brand' : 'border-gray-300'}`}
              >
                {on && <span className="size-2.5 rounded-full bg-brand" />}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** 포트폴리오를 쓰는 동안 보여줘요. 다 쓰면 나올 두 칸 화면과 같은 배치예요. quiet면 계정에서 불러오는 중이라 안내 글을 빼요. */
function Writing({ quiet = false }: { quiet?: boolean }) {
  const L = useMessages(TEXT)
  return (
    <div className={`${canvas} flex-row!`} aria-busy="true">
      {!quiet && <p role="status" className="sr-only">{L.writing}</p>}
      <div className="flex w-[340px] shrink-0 flex-col gap-2 border-r border-gray-200 p-4">
        {!quiet && <p className="mb-2 text-[13px] font-medium text-gray-500">{L.writingLong}</p>}
        {[0, 1, 2, 3].map((item) => (
          <div key={item} aria-hidden className="flex h-[58px] items-center gap-3 rounded-xl border border-gray-200 bg-white px-3">
            <Bone className="h-4 w-4" />
            <Bone className="h-4 w-28" />
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-1 overflow-hidden px-6 py-8 md:px-10" aria-hidden>
        <div className={`${paper} flex flex-col gap-3`}>
          <Bone className="h-8 w-56" />
          <Bone className="mt-6 h-6 w-36" />
          <Bone className="h-4 w-full" />
          <Bone className="h-4 w-5/6" />
          <Bone className="h-4 w-2/3" />
          <Bone className="mt-6 h-6 w-28" />
          <Bone className="h-4 w-1/2" />
          <Bone className="h-4 w-1/3" />
        </div>
      </div>
    </div>
  )
}

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** AI가 쓴 글이라 HTML은 글자 그대로 보여주고, 웹 주소가 아닌 링크는 막아요. */
const markdown = new Marked({
  gfm: true,
  renderer: {
    html: ({ text }) => escapeHtml(text),
  },
  walkTokens: (token) => {
    if ((token.type === 'link' || token.type === 'image') && !/^https?:\/\//i.test(token.href)) token.href = '#'
  },
})

/** 서식 복사에 쓰는 HTML이에요. 미리보기와 같은 규칙으로 그려요. */
function toHtml(name: string, sections: PortfolioSection[]): string {
  return `<h1>${escapeHtml(name)}</h1>${sections.map((section) => `<h2>${escapeHtml(section.title)}</h2>${markdown.parse(section.content, { async: false })}`).join('')}`
}

/** 만든 포트폴리오를 고치는 화면이에요. 왼쪽은 항목의 순서와 고치기, 오른쪽은 마크다운 미리보기예요. */
function Editor({ saved, name, onChange }: { saved: SavedPortfolio; name: string; onChange: (next: SavedPortfolio) => void }) {
  const L = useMessages(TEXT)
  const sections = saved.sections
  /** 지금 고치는 중인 항목 */
  const [revising, setRevising] = useState<PortfolioKey | null>(null)
  /** 고칠 내용을 고르는 작은 창이 열린 항목 */
  const [asking, setAsking] = useState<PortfolioKey | null>(null)
  const [removing, setRemoving] = useState<PortfolioSection | null>(null)
  const previewRef = useRef<HTMLElement>(null)
  const latest = useRef(saved)
  latest.current = saved

  function update(next: PortfolioSection[]) {
    onChange({ ...latest.current, sections: next })
  }

  async function revise(key: PortfolioKey, revision: RevisionKey | 'add') {
    setAsking(null)
    setRevising(key)
    const current = latest.current.sections.find((item) => item.key === key)
    const result = await revisePortfolio(
      saved.repo,
      key,
      revision === 'add' ? 'rewrite' : revision,
      current?.content ?? '',
      latest.current.plan,
      latest.current.person,
    )
    setRevising(null)
    track('portfolio_revise', { repo: saved.repo, section: key, revision, success: 'data' in result })
    if ('error' in result) {
      showToast(result.error)
      // 더하려던 항목은 글을 받지 못했으면 자리도 치워요.
      if (revision === 'add') update(latest.current.sections.filter((item) => item.key !== key || item.content.trim()))
      return
    }
    const now = latest.current.sections
    if (revision === 'add') update([...now.filter((item) => item.key !== key), result.data])
    else update(now.map((item) => (item.key === key ? { ...item, content: result.data.content } : item)))
  }

  const missing = portfolioSections().filter((item) => !sections.some((section) => section.key === item.key))

  return (
    <div className={`${canvas} flex-row!`}>
      <aside className="flex w-[340px] shrink-0 flex-col border-r border-gray-200">
        <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-4 pb-2">
          <h2 className="text-[13px] font-medium text-gray-500">{L.sections}</h2>
          {missing.length > 0 && (
            <MapMenu
              label={L.add}
              groups={[
                {
                  items: missing.map((item) => ({
                    label: item.title,
                    onSelect: () => {
                      // 더한 항목은 맨 아래에 자리를 먼저 잡아 두고 글을 받아 와요.
                      update([...latest.current.sections, { key: item.key, title: item.title, content: '' }])
                      void revise(item.key, 'add')
                    },
                  })),
                },
              ]}
            />
          )}
        </div>
        <SectionList
          sections={sections}
          revising={revising}
          asking={asking}
          onAsk={(key) => setAsking((prev) => (prev === key ? null : key))}
          onRevise={(key, revision) => void revise(key, revision)}
          onRemove={setRemoving}
          onReorder={(next) => {
            track('portfolio_reorder', { repo: saved.repo })
            update(next)
          }}
          onJump={(key) => previewRef.current?.querySelector(`[data-section="${key}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        />
      </aside>

      <section ref={previewRef} className="min-w-0 flex-1 overflow-y-auto px-6 py-8 md:px-10">
        <article className={paper}>
          <h1 className="text-[28px] leading-tight font-bold text-gray-900">{name}</h1>
          {sections.map((section) =>
            revising === section.key || !section.content.trim() ? (
              <div key={section.key} data-section={section.key} className="article mt-10 scroll-mt-6" aria-busy="true">
                <h2>{section.title}</h2>
                <div className="flex flex-col gap-2.5">
                  <Bone className="h-4 w-full" />
                  <Bone className="h-4 w-5/6" />
                  <Bone className="h-4 w-2/3" />
                </div>
              </div>
            ) : (
              <div
                key={section.key}
                data-section={section.key}
                className="article mt-10 scroll-mt-6"
                // 제목과 본문이 한 덩어리의 바로 아래 자식이어야 본문 모양(간격)이 그대로 입혀져요.
                dangerouslySetInnerHTML={{ __html: `<h2>${escapeHtml(section.title)}</h2>${markdown.parse(section.content, { async: false })}` }}
              />
            ),
          )}
        </article>
      </section>

      {removing && (
        <ConfirmDialog
          title={L.removeTitle}
          body={L.removeBody(removing.title)}
          confirm={L.removeConfirm}
          danger
          working={false}
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            update(latest.current.sections.filter((item) => item.key !== removing.key))
            setRemoving(null)
          }}
        />
      )}
    </div>
  )
}

/** 항목 사이의 간격(px). 끌어서 옮길 때 다른 항목과 자리를 바꾸는 거리를 셀 때 써요. */
const GAP = 8

interface Dragging {
  key: PortfolioKey
  /** 끄는 항목이 지금 자리에서 손가락을 따라 움직인 거리 */
  dy: number
  /** 지금 자리를 잡았을 때의 손가락 높이 */
  originY: number
}

/** 왼쪽의 항목 목록이에요. 손잡이를 끌거나, 손잡이에서 위아래 방향키를 눌러 순서를 바꿔요. */
function SectionList({ sections, revising, asking, onAsk, onRevise, onRemove, onReorder, onJump }: {
  sections: PortfolioSection[]
  revising: PortfolioKey | null
  asking: PortfolioKey | null
  onAsk: (key: PortfolioKey) => void
  onRevise: (key: PortfolioKey, revision: RevisionKey) => void
  onRemove: (section: PortfolioSection) => void
  onReorder: (next: PortfolioSection[]) => void
  onJump: (key: PortfolioKey) => void
}) {
  const L = useMessages(TEXT)
  const [order, setOrder] = useState(sections)
  const [drag, setDrag] = useState<Dragging | null>(null)
  const items = useRef(new Map<PortfolioKey, HTMLLIElement>())

  // 끄는 동안에는 화면에서만 순서를 바꾸고, 놓았을 때 저장해요.
  useEffect(() => {
    if (!drag) setOrder(sections)
  }, [sections, drag])

  function height(key: PortfolioKey) {
    return (items.current.get(key)?.offsetHeight ?? 0) + GAP
  }

  function onPointerDown(event: ReactPointerEvent, key: PortfolioKey) {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({ key, dy: 0, originY: event.clientY })
  }

  function onPointerMove(event: ReactPointerEvent) {
    if (!drag) return
    let dy = event.clientY - drag.originY
    let originY = drag.originY
    const next = [...order]
    let index = next.findIndex((item) => item.key === drag.key)
    // 옆 항목의 절반을 넘게 끌면 자리를 바꾸고, 바뀐 자리를 기준으로 다시 재요.
    while (dy > 0 && index < next.length - 1 && dy > height(next[index + 1].key) / 2) {
      const step = height(next[index + 1].key)
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      index += 1
      dy -= step
      originY += step
    }
    while (dy < 0 && index > 0 && -dy > height(next[index - 1].key) / 2) {
      const step = height(next[index - 1].key)
      ;[next[index], next[index - 1]] = [next[index - 1], next[index]]
      index -= 1
      dy += step
      originY -= step
    }
    if (next.some((item, at) => item !== order[at])) setOrder(next)
    setDrag({ key: drag.key, dy, originY })
  }

  function onPointerUp() {
    if (!drag) return
    setDrag(null)
    if (order.some((item, at) => item.key !== sections[at]?.key)) onReorder(order)
  }

  function onHandleKey(event: ReactKeyboardEvent, key: PortfolioKey) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    const index = sections.findIndex((item) => item.key === key)
    const target = event.key === 'ArrowUp' ? index - 1 : index + 1
    if (target < 0 || target >= sections.length) return
    const next = [...sections]
    ;[next[index], next[target]] = [next[target], next[index]]
    onReorder(next)
  }

  if (order.length === 0) {
    return <p className="px-4 pt-6 text-[13px] text-gray-500">{L.empty}</p>
  }

  return (
    <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-4" style={{ gap: GAP }}>
      {order.map((section) => {
        const dragging = drag?.key === section.key
        const preview = section.content.replace(/[#>*`|_-]/g, ' ').replace(/\s+/g, ' ').trim()
        return (
          <li
            key={section.key}
            ref={(element) => {
              if (element) items.current.set(section.key, element)
              else items.current.delete(section.key)
            }}
            style={dragging ? { transform: `translateY(${drag.dy}px)` } : undefined}
            className={`relative rounded-xl border bg-white ${dragging ? 'z-10 border-brand' : 'border-gray-200'}`}
          >
            <div className="flex items-start gap-1 py-2.5 pr-2 pl-1.5">
              <button
                type="button"
                data-no-press
                aria-label={L.reorder(section.title)}
                onPointerDown={(event) => onPointerDown(event, section.key)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onKeyDown={(event) => onHandleKey(event, section.key)}
                className={`flex h-8 w-6 shrink-0 touch-none items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 ${
                  dragging ? 'cursor-grabbing' : 'cursor-grab'
                }`}
              >
                <svg viewBox="0 0 16 16" fill="currentColor" className="size-4" aria-hidden="true">
                  <circle cx="6" cy="4" r="1.1" />
                  <circle cx="10" cy="4" r="1.1" />
                  <circle cx="6" cy="8" r="1.1" />
                  <circle cx="10" cy="8" r="1.1" />
                  <circle cx="6" cy="12" r="1.1" />
                  <circle cx="10" cy="12" r="1.1" />
                </svg>
              </button>
              <button type="button" onClick={() => onJump(section.key)} className="min-w-0 flex-1 py-1 text-left">
                <span className="block text-[14px] font-semibold text-gray-900">{section.title}</span>
                <span className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-gray-500">
                  {revising === section.key ? L.revising : preview || L.pending}
                </span>
              </button>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  disabled={revising !== null}
                  aria-expanded={asking === section.key}
                  onClick={() => onAsk(section.key)}
                  className={ghostButton}
                >
                  {L.revise}
                </button>
                <button
                  type="button"
                  aria-label={L.remove(section.title)}
                  disabled={revising === section.key}
                  onClick={() => onRemove(section)}
                  className={iconButton}
                >
                  <CloseIcon />
                </button>
              </div>
            </div>
            {asking === section.key && (
              <RevisionPicker
                title={L.reviseTitle}
                options={revisions()}
                onPick={(revision) => onRevise(section.key, revision)}
                onClose={() => onAsk(section.key)}
                className="mx-2 mb-2"
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}
