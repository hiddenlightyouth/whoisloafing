import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useDismiss } from '../hooks/useDismiss'
import { track } from '../lib/analytics'
import { fetchPortfolioPeople, type PortfolioPerson } from '../lib/portfolio'
import {
  createResumeProject,
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
  type ResumeProblem,
  type ResumeProject,
  type ResumeRevisionKey,
} from '../lib/resume'
import { showToast } from '../lib/toast'
import { messages, useMessages } from '../lib/i18n'
import { toolButton } from './DeepParts'
import { ConfirmDialog } from './Dialog'
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
    copied: '복사했어요',
    copyFailed: '복사하지 못했어요',
    emptyTitle: '분석한 레포로 이력서의 프로젝트 경험을 써 드려요',
    emptyBody: '프로젝트를 추가하면 역할, 기술 스택, 문제와 개선과 효과로 나눈 문제 해결 경험을 채워요. 쓴 글은 눌러서 바로 고칠 수 있어요.',
    back: '이력서로 돌아가기',
    setupTitle: '참여자 중에서 나를 골라 주세요',
    setupHint: '고른 참여자의 커밋과 PR에서 맡은 역할과 문제 해결 경험을 찾아요.',
    planToggle: '기획안 붙여 넣기 (선택)',
    planPlaceholder: '기획안이나 서비스 소개 글을 붙여 넣으면 한 줄 소개를 더 정확하게 써요',
    create: '이력서에 추가',
    writing: '이력서를 쓰고 있어요. 1분쯤 걸려요.',
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
  },
  en: {
    title: 'Build a resume',
    pickTitle: 'Pick a project for your resume',
    add: 'Add project',
    copy: 'Copy',
    copyMarkdown: 'Copy Markdown',
    copied: 'Copied',
    copyFailed: 'Could not copy',
    emptyTitle: 'Turn your analyzed repos into resume projects',
    emptyBody: 'Add a project and we will fill in your role, tech stack, and problem solving split into problem, solution, and impact. Click anything to edit it.',
    back: 'Back to resume',
    setupTitle: 'Who are you in this project?',
    setupHint: "We look for your role and problems you solved in this person's commits and PRs.",
    planToggle: 'Paste a project plan (optional)',
    planPlaceholder: 'A plan or description of the service helps write a sharper one line summary',
    create: 'Add to resume',
    writing: 'Writing your resume. This takes about a minute.',
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
  },
})

type Mode = { kind: 'doc' } | { kind: 'pick' } | { kind: 'setup'; repo: string }

/**
 * 앱에서 쓰는 이력서 만들기 화면이에요. 분석해 둔 레포를 하나씩 골라 이력서의 프로젝트 경험으로 쌓고,
 * 한 장의 문서처럼 보면서 칸을 고치거나 문제 해결 경험을 다듬어요. 이력서는 이 기기에 하나만 둬요.
 */
export function Resume({ onNew, refreshKey }: { onNew: () => void; refreshKey: number }) {
  const L = useMessages(TEXT)
  const [mode, setMode] = useState<Mode>({ kind: 'doc' })

  if (mode.kind === 'pick') {
    return (
      <RepoGallery
        key={refreshKey}
        title={L.pickTitle}
        onNew={onNew}
        onBack={() => setMode({ kind: 'doc' })}
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

const backButton = 'flex size-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900'

function BackIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-4" aria-hidden="true">
      <path d="M10 3.5L5.5 8 10 12.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** 나를 고르고 기획안을 붙여 넣은 뒤 이력서에 프로젝트를 더해요. 쓰는 동안은 문서로 돌아가서 기다려요. */
function Setup({ repo, onBack, onStarted }: { repo: string; onBack: () => void; onStarted: () => void }) {
  const L = useMessages(TEXT)
  const [owner, name] = repo.split('/')
  const [people, setPeople] = useState<PortfolioPerson[] | 'loading' | { error: string } | null>(null)
  const [person, setPerson] = useState<string | null>(null)
  const [planOpen, setPlanOpen] = useState(false)
  const [plan, setPlan] = useState('')

  async function loadPeople() {
    setPeople('loading')
    const result = await fetchPortfolioPeople(repo)
    if ('data' in result && result.data.length === 1) setPerson(result.data[0].id)
    setPeople('data' in result ? result.data : { error: result.error })
  }

  useEffect(() => {
    void loadPeople()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo])

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

  return (
    <main className="flex min-h-0 flex-1 flex-col px-6 pt-14 md:px-10">
      <div className="flex shrink-0 items-center gap-2 pt-4 pb-4">
        <button type="button" aria-label={L.back} onClick={onBack} className={`-ml-2 ${backButton}`}>
          <BackIcon />
        </button>
        <div className="min-w-0">
          <p className="text-[12px] text-gray-500">{owner}</p>
          <h1 className="truncate text-[20px] leading-tight font-semibold text-gray-900">{name}</h1>
        </div>
      </div>
      <div className="-mx-6 flex min-h-0 flex-1 flex-col border-t border-gray-200 bg-gray-50 md:-mx-10">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 md:px-10">
          <div className="mx-auto w-full max-w-[640px] animate-rise">
            <h2 className="text-[19px] font-semibold text-gray-900">{L.setupTitle}</h2>
            <p className="mt-1.5 text-[13.5px] text-gray-500">{L.setupHint}</p>
            <PeopleList people={people} person={person} onPick={setPerson} onRetry={() => void loadPeople()} />

            <button
              type="button"
              aria-expanded={planOpen}
              onClick={() => setPlanOpen((prev) => !prev)}
              className="mt-6 flex items-center gap-1.5 text-[13.5px] font-medium text-gray-600 hover:text-gray-900"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className={`size-3.5 transition-transform ${planOpen ? 'rotate-90' : ''}`} aria-hidden="true">
                <path d="M6 3.5 10.5 8 6 12.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {L.planToggle}
            </button>
            {planOpen && (
              <div className="animate-rise">
                <textarea
                  value={plan}
                  maxLength={PLAN_MAX}
                  onChange={(event) => setPlan(event.target.value)}
                  placeholder={L.planPlaceholder}
                  className="mt-3 h-48 w-full resize-none rounded-xl border border-gray-200 bg-white p-4 text-[14px] leading-relaxed text-gray-900 outline-none placeholder:text-gray-400 focus:border-brand"
                />
                <p className="mt-1.5 text-right text-[12px] text-gray-400 tabular-nums">
                  {plan.length.toLocaleString()} / {PLAN_MAX.toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="shrink-0 border-t border-gray-200 bg-white px-6 py-3 md:px-10">
          <div className="mx-auto flex w-full max-w-[640px] items-center justify-end gap-2">
            <ModelMenu up />
            <button
              type="button"
              disabled={person === null}
              onClick={create}
              className="h-9 rounded-lg bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:bg-gray-300"
            >
              {L.create}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

/** 이력서 한 장이에요. 프로젝트를 차례로 늘어놓고, 마우스를 올리면 고치는 버튼이 나와요. */
function Document({ onAdd }: { onAdd: () => void }) {
  const L = useMessages(TEXT)
  const projects = useResume()
  const [editing, setEditing] = useState<string | null>(null)
  const [removing, setRemoving] = useState<ResumeProject | null>(null)
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
    <main className="flex min-h-0 flex-1 flex-col px-6 pt-14 md:px-10">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 pt-4 pb-4">
        <h1 className="text-[22px] leading-snug font-semibold text-gray-900">{L.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {ready.length > 0 && <CopyButtons projects={ready} />}
          <button
            type="button"
            onClick={onAdd}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-[13px] font-semibold whitespace-nowrap text-white transition-colors hover:bg-brand-hover"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="size-3.5" aria-hidden="true">
              <path d="M8 3v10M3 8h10" />
            </svg>
            {L.add}
          </button>
        </div>
      </div>

      <div className="-mx-6 min-h-0 flex-1 overflow-y-auto border-t border-gray-200 bg-gray-50 px-4 py-8 md:-mx-10 md:px-10">
        <article className="mx-auto w-full max-w-[880px] rounded-xl border border-gray-200 bg-white px-6 py-8 md:px-12 md:py-12">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-[16px] font-semibold text-gray-900">{L.emptyTitle}</p>
              <p className="max-w-[440px] text-[13.5px] leading-relaxed break-keep text-gray-500">{L.emptyBody}</p>
              <button
                type="button"
                onClick={onAdd}
                className="mt-3 h-9 rounded-full bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover"
              >
                {L.add}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-12">
              {projects.map((project, index) =>
                project.pending ? (
                  <Writing key={project.id} name={project.name} />
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
    </main>
  )
}

function Writing({ name }: { name: string }) {
  const L = useMessages(TEXT)
  return (
    <section aria-busy="true" className="animate-rise">
      <p role="status" className="mb-4 text-[13px] font-medium text-gray-500">
        {name}, {L.writing}
      </p>
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

const iconButton =
  'flex size-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:text-gray-200 disabled:hover:bg-transparent'

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
        <button type="button" onClick={onEdit} className="h-8 rounded-md px-2.5 text-[12.5px] font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900">
          {L.edit}
        </button>
        <button type="button" aria-label={L.remove} onClick={onRemove} className={iconButton}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="size-3.5" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
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
                  className="h-7 rounded-md px-2 text-[12.5px] font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:text-gray-300"
                >
                  {L.revise}
                </button>
                <button type="button" aria-label={L.deleteProblem} disabled={revising === index} onClick={() => setRemovingProblem(index)} className={`${iconButton} size-7`}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="size-3.5" aria-hidden="true">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>
            </div>
            {asking === index && <RevisionPicker onPick={(revision) => void revise(index, revision)} onClose={() => setAsking(null)} />}
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
        className="mt-3 ml-[17px] flex h-7 items-center gap-1 rounded-md px-1.5 text-[12.5px] font-medium text-gray-400 opacity-0 transition hover:bg-gray-100 hover:text-gray-800 group-focus-within/project:opacity-100 group-hover/project:opacity-100 disabled:text-gray-300"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="size-3" aria-hidden="true">
          <path d="M8 3v10M3 8h10" />
        </svg>
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

/** 경험 아래에 펼쳐지는 작은 창이에요. 고칠 방향을 글로 적지 않고 골라요. */
function RevisionPicker({ onPick, onClose }: { onPick: (revision: ResumeRevisionKey) => void; onClose: () => void }) {
  const L = useMessages(TEXT)
  const ref = useRef<HTMLDivElement>(null)

  // 다듬기 버튼을 다시 누른 것은 버튼이 알아서 닫아요.
  useDismiss(true, ref, onClose, { capture: true, ignore: (target) => !!target.closest('[aria-expanded="true"]') })

  return (
    <div ref={ref} role="dialog" aria-label={L.reviseTitle} className="mt-1.5 ml-6 origin-top-left animate-pop rounded-lg border border-gray-200 bg-white px-3 pt-2.5 pb-3">
      <p className="text-[12.5px] font-medium text-gray-500">{L.reviseTitle}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {resumeRevisions().map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onPick(item.key)}
            className="h-7 rounded-md border border-gray-200 bg-white px-2.5 text-[12.5px] text-gray-700 transition-colors hover:border-brand hover:text-brand-hover"
          >
            {item.label}
          </button>
        ))}
      </div>
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
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="size-3.5" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
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
          className="flex h-8 items-center gap-1 rounded-md px-2 text-[13px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="size-3" aria-hidden="true">
            <path d="M8 3v10M3 8h10" />
          </svg>
          {L.addProblemManual}
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={toolButton}>
            {L.cancel}
          </button>
          <button type="button" onClick={save} className="h-9 rounded-lg bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover">
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
  const [state, setState] = useState<{ which: 'rich' | 'markdown'; ok: boolean } | null>(null)

  async function copy(which: 'rich' | 'markdown') {
    let ok: boolean
    if (which === 'markdown') {
      ok = await navigator.clipboard.writeText(toMarkdown(projects)).then(
        () => true,
        () => false,
      )
    } else {
      const plain = toPlainText(projects)
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([toHtml(projects)], { type: 'text/html' }),
            'text/plain': new Blob([plain], { type: 'text/plain' }),
          }),
        ])
        ok = true
      } catch {
        // 서식 복사를 막는 브라우저에서는 글만 복사해요.
        ok = await navigator.clipboard.writeText(plain).then(
          () => true,
          () => false,
        )
      }
    }
    track('resume_copy', { format: which, success: ok })
    setState({ which, ok })
    setTimeout(() => setState(null), 2000)
  }

  const label = (which: 'rich' | 'markdown', idle: string) => (state?.which === which ? (state.ok ? L.copied : L.copyFailed) : idle)

  return (
    <>
      <button type="button" onClick={() => void copy('markdown')} className={`${toolButton} whitespace-nowrap`}>
        {label('markdown', L.copyMarkdown)}
      </button>
      <button type="button" onClick={() => void copy('rich')} className={`${toolButton} whitespace-nowrap`}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" className="size-4" aria-hidden="true">
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
          <path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" />
        </svg>
        {label('rich', L.copy)}
      </button>
    </>
  )
}
