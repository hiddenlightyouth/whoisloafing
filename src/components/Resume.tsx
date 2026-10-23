import { useEffect, useState, type ReactNode } from 'react'
import { track } from '../lib/analytics'
import { useAuth } from '../lib/auth'
import { fetchPortfolioPeople, type PortfolioPerson } from '../lib/portfolio'
import {
  clearResume,
  createResumeProject,
  loadResume,
  newId,
  PROBLEM_FIELDS,
  RESUME_LABELS,
  resumeRevisions,
  reviseResumeProblem,
  setResume,
  toHtml,
  toMarkdown,
  toPlainText,
  useResume,
  useResumeLoading,
  type ResumeProblem,
  type ResumeProject,
  type ResumeRevisionKey,
} from '../lib/resume'
import { showToast } from '../lib/toast'
import { messages, useMessages } from '../lib/i18n'
import { canvas, CloseIcon, copyText, CopyButton, ghostButton, iconButton, pageFrame, PageHeader, paper, PlanField, PlusIcon, RevisionPicker, StepLayout, Steps, StepTitle } from './AppPage'
import { toolButton } from './DeepParts'
import { ConfirmDialog, primaryButton } from './Dialog'
import { PeopleList } from './Portfolio'
import { RepoGallery } from './RepoGallery'
import { ModelMenu } from './ModelMenu'
import { Bone } from './Skeleton'

/** 기획안은 이만큼까지만 받아요. 서버도 같은 길이로 막아요. */
const PLAN_MAX = 8000

const TEXT = messages({
  ko: {
    title: '이력서 만들기',
    pickTitle: '이력서에 넣을 프로젝트',
    add: '프로젝트 추가',
    copy: '복사하기',
    copyMarkdown: '마크다운 복사',
    back: '레포 고르는 화면으로 돌아가기',
    steps: { plan: '추가 정보', person: '대상 선택' } as Record<SetupStep, string>,
    planTitle: '참고할 기획안이 있나요?',
    planHint: '한 줄 소개와 설명은 기획안을 참고해서 써요. 없으면 비워 두고 넘어가도 괜찮아요.',
    planPlaceholder: '기획안이나 서비스 소개 글을 붙여 넣어 주세요',
    setupTitle: '참여자 중에서 나를 골라 주세요',
    setupHint: '고른 참여자의 커밋과 PR에서 맡은 역할과 문제 해결 경험을 찾아요.',
    prev: '이전',
    next: '다음',
    skip: '건너뛰기',
    create: '이력서에 추가',
    edit: '고치기',
    done: '완료',
    cancel: '취소',
    moveUp: '위로 옮기기',
    moveDown: '아래로 옮기기',
    remove: '빼기',
    removeTitle: '이 프로젝트를 뺄까요?',
    removeBody: (name: string) => `이력서에서 ${name} 프로젝트를 빼요. 쓴 글은 지워지고 되돌릴 수 없어요.`,
    removeProblemTitle: '이 경험을 뺄까요?',
    removeProblemBody: (title: string) => `${title} 경험을 이력서에서 빼요.`,
    revise: '다듬기',
    reviseTitle: '어떻게 다듬을까요?',
    addProblem: '경험 추가',
    revising: '다듬고 있어요',
    fields: { headline: '한 줄 소개', name: '프로젝트 이름', kind: '종류', period: '기간', summary: '설명', problemTitle: '경험 제목' },
    stackHint: '쉼표로 나눠 적어요',
    addProblemManual: '빈 경험 추가',
    deleteProblem: '경험 빼기',
    clear: '지우기',
    clearTitle: '이력서를 지울까요?',
    clearBody: '이력서의 프로젝트를 모두 지워요. 계정에서도 지워지고 되돌릴 수 없어요.',
  },
  en: {
    title: 'Build a resume',
    pickTitle: 'Pick a project for your resume',
    add: 'Add project',
    copy: 'Copy',
    copyMarkdown: 'Copy Markdown',
    back: 'Back to repositories',
    steps: { plan: 'Additional info', person: 'Select person' },
    planTitle: 'Do you have a plan to reference?',
    planHint: 'The summary and description are taken from your plan. You can leave it empty and move on.',
    planPlaceholder: 'Paste a project plan or a description of the service',
    setupTitle: 'Who are you in this project?',
    setupHint: "We look for your role and problems you solved in this person's commits and PRs.",
    prev: 'Back',
    next: 'Next',
    skip: 'Skip',
    create: 'Add to resume',
    edit: 'Edit',
    done: 'Done',
    cancel: 'Cancel',
    moveUp: 'Move up',
    moveDown: 'Move down',
    remove: 'Remove',
    removeTitle: 'Remove this project?',
    removeBody: (name: string) => `${name} will be removed from your resume. This cannot be undone.`,
    removeProblemTitle: 'Remove this entry?',
    removeProblemBody: (title: string) => `${title} will be removed from your resume.`,
    revise: 'Revise',
    reviseTitle: 'What should change?',
    addProblem: 'Add entry',
    revising: 'Revising',
    fields: { headline: 'One line summary', name: 'Project name', kind: 'Type', period: 'Period', summary: 'Description', problemTitle: 'Entry title' },
    stackHint: 'Separate with commas',
    addProblemManual: 'Add empty entry',
    deleteProblem: 'Remove entry',
    clear: 'Delete',
    clearTitle: 'Delete this resume?',
    clearBody: 'Every project on your resume will be deleted from your account. This cannot be undone.',
  },
})

type SetupStep = 'plan' | 'person'

type Mode = { kind: 'doc' } | { kind: 'pick' } | { kind: 'setup'; repo: string }

/**
 * 앱에서 쓰는 이력서 만들기 화면이에요. 분석해 둔 레포를 하나씩 골라 이력서의 프로젝트 경험으로 쌓고,
 * 한 장의 문서처럼 보면서 칸을 고치거나 문제 해결 경험을 다듬어요. 이력서는 이 기기에 하나만 둬요.
 */
export function Resume({ onNew, refreshKey }: { onNew: () => void; refreshKey: number }) {
  const L = useMessages(TEXT)
  const [mode, setMode] = useState<Mode>({ kind: 'doc' })
  const account = useAuth().me?.email ?? null
  const projects = useResume()
  const loading = useResumeLoading()
  /** 계정의 이력서를 받아 봤는지. 받기 전에 비어 보인다고 갤러리를 띄웠다가 문서로 바뀌지 않게 해요. */
  const [checked, setChecked] = useState(false)
  // 아직 넣은 프로젝트가 없으면 빈 문서 대신 프로젝트를 고르는 갤러리부터 보여줘요. 돌아갈 문서가 없어서 뒤로 가기는 두지 않아요.
  const empty = checked && !loading && projects.length === 0

  useEffect(() => {
    let alive = true
    void loadResume(account).then(() => alive && setChecked(true))
    return () => {
      alive = false
    }
  }, [account])

  if (mode.kind === 'pick' || (mode.kind === 'doc' && empty)) {
    return (
      <RepoGallery
        key={refreshKey}
        title={empty ? L.title : L.pickTitle}
        onNew={onNew}
        onBack={empty ? undefined : () => setMode({ kind: 'doc' })}
        onOpen={(repo) => {
          track('resume_repo_select', { repo })
          setMode({ kind: 'setup', repo })
        }}
      />
    )
  }
  if (mode.kind === 'setup') {
    return <Setup repo={mode.repo} onBack={() => setMode({ kind: 'pick' })} onStarted={() => setMode({ kind: 'doc' })} />
  }
  return <Document onAdd={() => setMode({ kind: 'pick' })} />
}

/** 기획안과 나를 차례로 정하고 이력서에 프로젝트를 더해요. 포트폴리오 만들기와 같은 단계 화면이에요. 쓰는 동안은 문서로 돌아가서 기다려요. */
function Setup({ repo, onBack, onStarted }: { repo: string; onBack: () => void; onStarted: () => void }) {
  const L = useMessages(TEXT)
  const [owner, name] = repo.split('/')
  const [step, setStep] = useState<SetupStep>('plan')
  const [people, setPeople] = useState<PortfolioPerson[] | 'loading' | { error: string } | null>(null)
  const [person, setPerson] = useState<string | null>(null)
  const [plan, setPlan] = useState('')

  async function loadPeople() {
    setPeople('loading')
    const result = await fetchPortfolioPeople(repo)
    if ('data' in result && result.data.length === 1) setPerson(result.data[0].id)
    setPeople('data' in result ? result.data : { error: result.error })
  }

  // 참여자는 그 단계에 처음 들어왔을 때 받아요. 커밋 기록을 읽느라 시간이 조금 걸려요.
  useEffect(() => {
    if (step === 'person' && people === null) void loadPeople()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  function create() {
    const id = newId()
    const trimmed = plan.trim()
    // 자리를 먼저 잡아 두고 문서로 돌아가요. 다른 화면으로 가도 끝나면 저장돼요.
    setResume((prev) => [
      ...prev,
      { id, repo, person, plan: trimmed, name, headline: '', kind: '', period: '', summary: '', role: '', stack: [], problems: [], pending: true },
    ])
    onStarted()
    void createResumeProject(repo, person, trimmed).then((result) => {
      track('resume_create', { repo, plan: trimmed.length > 0, person: person !== null, success: 'data' in result })
      if ('error' in result) {
        showToast(result.error)
        setResume((prev) => prev.filter((item) => item.id !== id))
        return
      }
      setResume((prev) => prev.map((item) => (item.id === id ? { ...result.data, id, person, plan: trimmed } : item)))
    })
  }

  const last = step === 'person'

  return (
    <main className={pageFrame}>
      <PageHeader owner={owner} title={name} onBack={onBack} backLabel={L.back} />
      <StepLayout
        top={<Steps steps={(['plan', 'person'] as const).map((key) => ({ key, label: L.steps[key] }))} current={step} onSelect={setStep} />}
        buttons={
          <>
            {last && <ModelMenu up />}
            {last && (
              <button type="button" onClick={() => setStep('plan')} className={toolButton}>
                {L.prev}
              </button>
            )}
            <button type="button" disabled={last && person === null} onClick={() => (last ? create() : setStep('person'))} className={primaryButton}>
              {last ? L.create : plan.trim() ? L.next : L.skip}
            </button>
          </>
        }
      >
        <div key={step} className="animate-rise">
          {step === 'plan' ? (
            <>
              <StepTitle title={L.planTitle} hint={L.planHint} />
              <PlanField value={plan} max={PLAN_MAX} placeholder={L.planPlaceholder} onChange={setPlan} />
            </>
          ) : (
            <>
              <StepTitle title={L.setupTitle} hint={L.setupHint} />
              <PeopleList people={people} person={person} onPick={setPerson} onRetry={() => void loadPeople()} />
            </>
          )}
        </div>
      </StepLayout>
    </main>
  )
}

/** 이력서 한 장이에요. 프로젝트를 차례로 늘어놓고, 마우스를 올리면 고치는 버튼이 나와요. */
function Document({ onAdd }: { onAdd: () => void }) {
  const L = useMessages(TEXT)
  const projects = useResume()
  const loading = useResumeLoading()
  const [editing, setEditing] = useState<string | null>(null)
  const [removing, setRemoving] = useState<ResumeProject | null>(null)
  /** 이력서를 통째로 지우기 전에 한 번 더 묻는 창이 떠 있는지 */
  const [clearing, setClearing] = useState(false)
  const ready = projects.filter((item) => !item.pending)

  function move(project: ResumeProject, by: -1 | 1) {
    track('resume_move', { repo: project.repo })
    setResume((prev) => {
      const index = prev.findIndex((item) => item.id === project.id)
      const target = index + by
      if (index < 0 || target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  return (
    <main className={pageFrame}>
      <PageHeader
        title={L.title}
        actions={
          <>
            {ready.length > 0 && (
              <button type="button" onClick={() => setClearing(true)} className={`${toolButton} text-red-500!`}>
                {L.clear}
              </button>
            )}
            {ready.length > 0 && <CopyButtons projects={ready} />}
            <button type="button" onClick={onAdd} disabled={loading} className={`${toolButton} whitespace-nowrap disabled:opacity-50`}>
              <PlusIcon />
              {L.add}
            </button>
          </>
        }
      />

      <div className={`${canvas} overflow-y-auto px-6 py-8 md:px-10`}>
        <article className={paper}>
          {projects.length === 0 ? (
            <Loading />
          ) : (
            <div className="flex flex-col gap-12">
              {projects.map((project, index) =>
                project.pending ? (
                  <Writing key={project.id} />
                ) : editing === project.id ? (
                  <ProjectEditor key={project.id} project={project} onClose={() => setEditing(null)} />
                ) : (
                  <ProjectView
                    key={project.id}
                    project={project}
                    first={index === 0}
                    last={index === projects.length - 1}
                    onEdit={() => setEditing(project.id)}
                    onMove={(by) => move(project, by)}
                    onRemove={() => setRemoving(project)}
                  />
                ),
              )}
            </div>
          )}
        </article>
      </div>

      {removing && (
        <ConfirmDialog
          title={L.removeTitle}
          body={L.removeBody(removing.name)}
          confirm={L.remove}
          danger
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            track('resume_remove', { repo: removing.repo })
            setResume((prev) => prev.filter((item) => item.id !== removing.id))
            setRemoving(null)
          }}
        />
      )}

      {clearing && (
        <ConfirmDialog
          title={L.clearTitle}
          body={L.clearBody}
          confirm={L.clear}
          danger
          onCancel={() => setClearing(false)}
          onConfirm={() => {
            track('resume_delete', { projects: ready.length })
            clearResume()
            setClearing(false)
          }}
        />
      )}
    </main>
  )
}

/** 계정의 이력서를 받는 동안 보여줘요. 프로젝트 하나와 같은 배치예요. */
function Loading() {
  return (
    <div aria-busy="true" aria-hidden className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <Bone className="h-5 w-2/3" />
        <Bone className="h-4 w-40" />
      </div>
      <Bone className="h-4 w-3/4" />
      <Bone className="mt-2 h-4 w-5/6" />
      <Bone className="h-4 w-1/2" />
      <Bone className="mt-2 h-4 w-48" />
      <Bone className="ml-6 h-4 w-5/6" />
      <Bone className="ml-6 h-4 w-4/6" />
    </div>
  )
}

function Writing() {
  return (
    <section aria-busy="true" className="animate-rise">
      <div className="flex flex-col gap-3" aria-hidden>
        <div className="flex items-center justify-between gap-4">
          <Bone className="h-5 w-2/3" />
          <Bone className="h-4 w-40" />
        </div>
        <Bone className="h-4 w-3/4" />
        <Bone className="mt-2 h-4 w-5/6" />
        <Bone className="h-4 w-1/2" />
        <Bone className="mt-2 h-4 w-48" />
        <Bone className="ml-6 h-4 w-5/6" />
        <Bone className="ml-6 h-4 w-4/6" />
        <Bone className="ml-6 h-4 w-3/4" />
      </div>
    </section>
  )
}

/** 한 줄 안에 이름표와 글을 나란히 두는 줄이에요. 사진의 이력서처럼 이름표 칸의 폭을 맞춰요. */
function Row({ dot, label, children, labelClass = 'text-brand' }: { dot: string; label: ReactNode; children?: ReactNode; labelClass?: string }) {
  return (
    <li className="flex gap-3 text-[14.5px] leading-[1.75] text-gray-900">
      <span aria-hidden className={`mt-[0.7em] size-[5px] shrink-0 rounded-full ${dot}`} />
      <span className={`w-[60px] shrink-0 sm:w-[76px] ${labelClass}`}>{label}</span>
      <span className="min-w-0 flex-1 whitespace-pre-line break-keep [overflow-wrap:anywhere]">{children}</span>
    </li>
  )
}

function ProjectView({ project, first, last, onEdit, onMove, onRemove }: {
  project: ResumeProject
  first: boolean
  last: boolean
  onEdit: () => void
  onMove: (by: -1 | 1) => void
  onRemove: () => void
}) {
  const L = useMessages(TEXT)
  const F = useMessages(RESUME_LABELS)
  /** 다듬는 중인 경험의 순서. 새로 더하는 중이면 problems.length예요. */
  const [revising, setRevising] = useState<number | null>(null)
  const [asking, setAsking] = useState<number | null>(null)
  const [removingProblem, setRemovingProblem] = useState<number | null>(null)
  const meta = [project.kind, project.period].filter(Boolean).join(' | ')

  async function revise(index: number | null, revision: ResumeRevisionKey) {
    setAsking(null)
    const at = index ?? project.problems.length
    setRevising(at)
    const current = index === null ? null : project.problems[index]
    const result = await reviseResumeProblem(project, revision, current)
    setRevising(null)
    track('resume_revise', { repo: project.repo, revision: index === null ? 'add' : revision, success: 'data' in result })
    if ('error' in result) {
      showToast(result.error)
      return
    }
    // 기다리는 사이에 다른 칸을 고쳤을 수 있어서, 저장된 최신 값에 끼워 넣어요.
    setResume((prev) =>
      prev.map((item) => {
        if (item.id !== project.id) return item
        const problems = [...item.problems]
        if (index === null || current === null) problems.push(result.data)
        else {
          const found = problems.indexOf(current)
          problems.splice(found < 0 ? index : found, 1, result.data)
        }
        return { ...item, problems }
      }),
    )
  }

  return (
    <section className="group/project relative animate-rise">
      <div className="absolute -top-9 right-0 flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5 opacity-0 transition-opacity group-focus-within/project:opacity-100 group-hover/project:opacity-100">
        <button type="button" aria-label={L.moveUp} disabled={first} onClick={() => onMove(-1)} className={iconButton}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
            <path d="M8 12.5v-9M4 7l4-3.5L12 7" />
          </svg>
        </button>
        <button type="button" aria-label={L.moveDown} disabled={last} onClick={() => onMove(1)} className={iconButton}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
            <path d="M8 3.5v9M4 9l4 3.5L12 9" />
          </svg>
        </button>
        <button type="button" onClick={onEdit} className={ghostButton}>
          {L.edit}
        </button>
        <button type="button" aria-label={L.remove} onClick={onRemove} className={iconButton}>
          <CloseIcon />
        </button>
      </div>

      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="min-w-0 text-[17px] leading-snug font-semibold text-gray-900">
          {project.headline} &lt;{project.name}&gt;
        </h2>
        {meta && <p className="shrink-0 text-[13.5px] text-gray-500">{meta}</p>}
      </header>
      {project.summary && <p className="mt-2 text-[14px] leading-relaxed text-gray-500">{project.summary}</p>}

      <ul className="mt-4 flex flex-col gap-1.5">
        {project.role && (
          <Row dot="bg-brand" label={F.role}>
            {project.role}
          </Row>
        )}
        {project.stack.length > 0 && (
          <Row dot="bg-brand" label={F.stack}>
            {project.stack.join(', ')}
          </Row>
        )}
      </ul>

      <ul className="mt-1.5 flex flex-col gap-3">
        {project.problems.map((problem, index) => (
          <li key={`${index}:${problem.title}`} className="group/problem relative">
            <div className="flex items-start gap-3">
              <span aria-hidden className="mt-[0.75em] size-[5px] shrink-0 rounded-full bg-brand" />
              <h3 className="min-w-0 flex-1 text-[14.5px] leading-[1.75] font-semibold text-brand-hover">{problem.title}</h3>
              <div
                className={`flex shrink-0 items-center gap-0.5 transition-opacity group-focus-within/problem:opacity-100 group-hover/problem:opacity-100 ${
                  asking === index ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <button
                  type="button"
                  disabled={revising !== null}
                  aria-expanded={asking === index}
                  onClick={() => setAsking((prev) => (prev === index ? null : index))}
                  className={ghostButton}
                >
                  {L.revise}
                </button>
                <button type="button" aria-label={L.deleteProblem} disabled={revising === index} onClick={() => setRemovingProblem(index)} className={iconButton}>
                  <CloseIcon />
                </button>
              </div>
            </div>
            {asking === index && (
              <RevisionPicker
                title={L.reviseTitle}
                options={resumeRevisions()}
                onPick={(revision) => void revise(index, revision)}
                onClose={() => setAsking(null)}
                className="mt-1.5 ml-6"
              />
            )}
            {revising === index ? (
              <ProblemSkeleton label={L.revising} />
            ) : (
              <ul className="mt-1 flex flex-col gap-1 pl-3 sm:pl-6">
                {PROBLEM_FIELDS.filter((field) => problem[field].trim()).map((field) => (
                  <Row key={field} dot="bg-gray-300" label={F[field]} labelClass="text-gray-500">
                    {problem[field]}
                  </Row>
                ))}
              </ul>
            )}
          </li>
        ))}
        {revising === project.problems.length && (
          <li>
            <ProblemSkeleton label={L.revising} />
          </li>
        )}
      </ul>

      <button
        type="button"
        disabled={revising !== null}
        onClick={() => void revise(null, 'another')}
        className={`${ghostButton} mt-3 ml-[11px] flex items-center gap-1 opacity-0 transition group-focus-within/project:opacity-100 group-hover/project:opacity-100`}
      >
        <PlusIcon />
        {L.addProblem}
      </button>

      {removingProblem !== null && project.problems[removingProblem] && (
        <ConfirmDialog
          title={L.removeProblemTitle}
          body={L.removeProblemBody(project.problems[removingProblem].title)}
          confirm={L.remove}
          danger
          onCancel={() => setRemovingProblem(null)}
          onConfirm={() => {
            const target = project.problems[removingProblem]
            setResume((prev) => prev.map((item) => (item.id === project.id ? { ...item, problems: item.problems.filter((one) => one !== target) } : item)))
            setRemovingProblem(null)
          }}
        />
      )}
    </section>
  )
}

function ProblemSkeleton({ label }: { label: string }) {
  return (
    <div className="mt-2 flex flex-col gap-2 pl-6" aria-busy="true">
      <span className="sr-only">{label}</span>
      <Bone className="h-4 w-5/6" />
      <Bone className="h-4 w-4/6" />
      <Bone className="h-4 w-3/4" />
    </div>
  )
}

const input =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[14px] leading-relaxed text-gray-900 outline-none placeholder:text-gray-400 focus:border-brand'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12.5px] font-medium text-gray-500">{label}</span>
      {children}
    </label>
  )
}

const emptyProblem = (): ResumeProblem => ({ title: '', problem: '', cause: '', solution: '', effect: '', decision: '' })

/** 프로젝트의 칸을 직접 고치는 양식이에요. 완료를 눌러야 저장해요. */
function ProjectEditor({ project, onClose }: { project: ResumeProject; onClose: () => void }) {
  const L = useMessages(TEXT)
  const F = useMessages(RESUME_LABELS)
  const [draft, setDraft] = useState(project)
  const [stack, setStack] = useState(project.stack.join(', '))

  const set = <K extends keyof ResumeProject>(key: K, value: ResumeProject[K]) => setDraft((prev) => ({ ...prev, [key]: value }))
  const setProblem = (index: number, key: keyof ResumeProblem, value: string) =>
    setDraft((prev) => ({ ...prev, problems: prev.problems.map((item, at) => (at === index ? { ...item, [key]: value } : item)) }))

  function save() {
    track('resume_edit', { repo: project.repo })
    const next: ResumeProject = {
      ...draft,
      stack: stack.split(',').map((item) => item.trim()).filter(Boolean),
      problems: draft.problems.filter((item) => item.title.trim() || PROBLEM_FIELDS.some((field) => item[field].trim())),
    }
    setResume((prev) => prev.map((item) => (item.id === project.id ? next : item)))
    onClose()
  }

  return (
    <section className="animate-rise rounded-xl border border-brand p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={L.fields.headline}>
          <input className={input} value={draft.headline} onChange={(event) => set('headline', event.target.value)} />
        </Field>
        <Field label={L.fields.name}>
          <input className={input} value={draft.name} onChange={(event) => set('name', event.target.value)} />
        </Field>
        <Field label={L.fields.kind}>
          <input className={input} value={draft.kind} onChange={(event) => set('kind', event.target.value)} />
        </Field>
        <Field label={L.fields.period}>
          <input className={input} value={draft.period} onChange={(event) => set('period', event.target.value)} />
        </Field>
      </div>
      <div className="mt-3 flex flex-col gap-3">
        <Field label={L.fields.summary}>
          <input className={input} value={draft.summary} onChange={(event) => set('summary', event.target.value)} />
        </Field>
        <Field label={F.role}>
          <textarea rows={2} className={`${input} resize-none`} value={draft.role} onChange={(event) => set('role', event.target.value)} />
        </Field>
        <Field label={`${F.stack} (${L.stackHint})`}>
          <input className={input} value={stack} onChange={(event) => setStack(event.target.value)} />
        </Field>
      </div>

      {draft.problems.map((problem, index) => (
        <div key={index} className="mt-5 rounded-lg bg-gray-50 p-4">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Field label={L.fields.problemTitle}>
                <input className={`${input} font-semibold`} value={problem.title} onChange={(event) => setProblem(index, 'title', event.target.value)} />
              </Field>
            </div>
            <button
              type="button"
              aria-label={L.deleteProblem}
              onClick={() => setDraft((prev) => ({ ...prev, problems: prev.problems.filter((_, at) => at !== index) }))}
              className={`${iconButton} mb-1`}
            >
              <CloseIcon />
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-2.5">
            {PROBLEM_FIELDS.map((field) => (
              <Field key={field} label={F[field]}>
                <textarea
                  rows={field === 'solution' ? 3 : 2}
                  className={`${input} resize-y`}
                  value={problem[field]}
                  onChange={(event) => setProblem(index, field, event.target.value)}
                />
              </Field>
            ))}
          </div>
        </div>
      ))}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setDraft((prev) => ({ ...prev, problems: [...prev.problems, emptyProblem()] }))}
          className={`${ghostButton} flex items-center gap-1`}
        >
          <PlusIcon />
          {L.addProblemManual}
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={toolButton}>
            {L.cancel}
          </button>
          <button type="button" onClick={save} className={primaryButton}>
            {L.done}
          </button>
        </div>
      </div>
    </section>
  )
}

/** 서식을 지킨 복사(워드, 구글 문서, 노션)와 마크다운 복사예요. */
function CopyButtons({ projects }: { projects: ResumeProject[] }) {
  const L = useMessages(TEXT)

  async function copyRich() {
    const plain = toPlainText(projects)
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([toHtml(projects)], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        }),
      ])
      return true
    } catch {
      // 서식 복사를 막는 브라우저에서는 글만 복사해요.
      return copyText(plain)
    }
  }

  return (
    <>
      <CopyButton
        label={L.copyMarkdown}
        onCopy={async () => {
          const ok = await copyText(toMarkdown(projects))
          track('resume_copy', { format: 'markdown', success: ok })
          return ok
        }}
      />
      <CopyButton
        label={L.copy}
        onCopy={async () => {
          const ok = await copyRich()
          track('resume_copy', { format: 'rich', success: ok })
          return ok
        }}
      />
    </>
  )
}
