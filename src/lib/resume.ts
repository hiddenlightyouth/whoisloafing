import { useSyncExternalStore } from 'react'
import { authFetch } from './auth'
import { DEEP_ERRORS } from './api'
import { getLang, messages, pick } from './i18n'
import { getModel, refreshUsage } from './usage'
import { cancelSave, canSync, fetchSaved, putSaved, scheduleSave } from './saved'
import { readFlag, readJson, writeFlag, writeItem, writeJson } from './storage'

/** 문제 해결 경험 하나. 서버의 ResumeProblemDto와 맞춰요. 원인과 판단은 비어 있을 수 있어요. */
export interface ResumeProblem {
  title: string
  problem: string
  cause: string
  solution: string
  effect: string
  decision: string
}

/** 이력서의 프로젝트 하나. 서버가 쓴 글에 고칠 때 다시 보낼 값(레포, 고른 사람, 기획안)을 같이 둬요. */
export interface ResumeProject {
  id: string
  repo: string
  person: string | null
  plan: string
  name: string
  headline: string
  kind: string
  period: string
  summary: string
  role: string
  stack: string[]
  problems: ResumeProblem[]
  /** 서버가 아직 쓰고 있는 프로젝트. 계정에도 이 기기에도 저장하지 않아요. */
  pending?: boolean
}

/** 문제 해결 경험을 고칠 때 고르는 요청. 서버의 ResumeRevision과 맞춰요. */
export type ResumeRevisionKey = 'shorter' | 'concrete' | 'numbers' | 'rewrite' | 'another'

const REVISION_LABELS = messages<{ key: ResumeRevisionKey; label: string }[]>({
  ko: [
    { key: 'shorter', label: '더 짧게' },
    { key: 'concrete', label: '더 구체적으로' },
    { key: 'numbers', label: '수치 넣기' },
    { key: 'rewrite', label: '다시 쓰기' },
    { key: 'another', label: '다른 경험으로 바꾸기' },
  ],
  en: [
    { key: 'shorter', label: 'Shorter' },
    { key: 'concrete', label: 'More specific' },
    { key: 'numbers', label: 'Add numbers' },
    { key: 'rewrite', label: 'Rewrite' },
    { key: 'another', label: 'Swap for another' },
  ],
})

export const resumeRevisions = () => pick(REVISION_LABELS)

/** 이력서에 적는 칸의 이름이에요. 미리보기, 고치는 칸, 복사한 글이 같이 써요. */
export const RESUME_LABELS = messages({
  ko: { role: '역할', stack: '기술 스택', problem: '문제', cause: '원인', solution: '개선', effect: '효과', decision: '판단' },
  en: { role: 'Role', stack: 'Tech stack', problem: 'Problem', cause: 'Cause', solution: 'Solution', effect: 'Impact', decision: 'Trade-off' },
})

/** 문제 해결 경험의 칸 순서예요. */
export const PROBLEM_FIELDS = ['problem', 'cause', 'solution', 'effect', 'decision'] as const

const ERRORS = messages<Record<string, string>>({
  ko: {
    ...DEEP_ERRORS.ko,
    C5031: '글을 쓰지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
    failed: '이력서를 쓰지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
  },
  en: {
    ...DEEP_ERRORS.en,
    C5031: "Couldn't write it. Please try again in a moment.",
    failed: "Couldn't write the resume. Please try again in a moment.",
  },
})

type Outcome<T> = { data: T } | { error: string }

async function call<T>(path: string, body: unknown): Promise<Outcome<T>> {
  try {
    const result = await authFetch<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (result.ok && result.data) {
      void refreshUsage()
      return { data: result.data }
    }
    return { error: (result.code && pick(ERRORS)[result.code]) || pick(ERRORS).failed }
  } catch {
    return { error: pick(ERRORS).network }
  }
}

type Written = Omit<ResumeProject, 'id' | 'person' | 'plan' | 'pending'>

export function createResumeProject(repo: string, person: string | null, plan: string) {
  return call<Written>('/portfolio/resume', { url: repo, person, plan: plan || null, lang: getLang(), model: getModel() })
}

/** 문제 해결 경험 하나를 고쳐요. problem이 없으면 새 경험을 하나 더 써요. */
export function reviseResumeProblem(project: ResumeProject, revision: ResumeRevisionKey, problem: ResumeProblem | null) {
  const avoid = project.problems.filter((item) => item !== problem).map((item) => item.title).slice(0, 10)
  return call<ResumeProblem>('/portfolio/resume/revise', {
    url: project.repo,
    revision,
    problem,
    avoid,
    plan: project.plan || null,
    person: project.person,
    lang: getLang(),
    model: getModel(),
  })
}

// 이력서는 계정에 하나만 둬요. 쓰는 중에 화면을 떠나도 끝나면 저장되게 화면 바깥에 들고 있어요.
// 계정에 저장할 수 없으면(예전 서버) 전처럼 이 기기에 둬요.
const SAVED_KEY = 'whoisloafing:resume:v1'
/** 이 기기의 이력서를 계정에 올리지 못했다는 표시. 있으면 다음에 계정의 것보다 이 기기의 것을 먼저 써요. */
const UNSYNCED_KEY = 'whoisloafing:resume:v1:unsynced'
const SAVED_PATH = '/portfolio/resume/saved'

// 새로 고치면 쓰던 요청은 사라지니, 쓰는 중이던 프로젝트는 다시 불러오지 않아요.
const readLocal = () => readJson<ResumeProject[]>(SAVED_KEY, []).filter((item) => !item.pending)

let projects: ResumeProject[] = readLocal()
/** 계정의 이력서를 받아 둔 계정. 이 값이 있으면 고칠 때마다 계정에 저장해요. */
let syncedFor: string | null = null
let loading = false
const listeners = new Set<() => void>()

const notify = () => listeners.forEach((listener) => listener())

const done = (list: ResumeProject[]) => list.filter((item) => !item.pending)

function writeLocal(list: ResumeProject[], unsynced: boolean) {
  writeJson(SAVED_KEY, done(list))
  writeFlag(UNSYNCED_KEY, unsynced)
}

function clearLocal() {
  writeItem(SAVED_KEY, null)
  writeFlag(UNSYNCED_KEY, false)
}

async function upload(list: ResumeProject[], keepalive = false) {
  if (await putSaved(SAVED_PATH, { data: done(list) }, keepalive)) clearLocal()
  else writeLocal(list, true)
}

/**
 * 계정에 저장한 이력서를 받아요. 이력서 화면을 열 때와 계정이 바뀔 때 불러요.
 * 계정에 없고 이 기기에만 있으면 계정에 올려서, 계정에 저장하기 전에 만든 이력서를 잃지 않아요.
 */
export async function loadResume(account: string | null) {
  if (syncedFor && syncedFor !== account) {
    cancelSave(SAVED_KEY)
    syncedFor = null
    projects = readLocal()
    notify()
  }
  if (!account || syncedFor === account || loading) return
  if (!(await canSync())) return
  cancelSave(SAVED_KEY)
  loading = true
  notify()
  const result = await fetchSaved<ResumeProject[]>(SAVED_PATH)
  loading = false
  if (!result) {
    notify()
    return
  }
  const local = readLocal()
  const pending = projects.filter((item) => item.pending)
  syncedFor = account
  if (result.data && !readFlag(UNSYNCED_KEY)) {
    clearLocal()
    projects = [...result.data, ...pending]
  } else {
    projects = [...local, ...pending]
    if (local.length > 0) void upload(local)
  }
  notify()
}

export function setResume(update: (prev: ResumeProject[]) => ResumeProject[]) {
  const before = done(projects)
  projects = update(projects)
  notify()
  const after = done(projects)
  if (after.length === before.length && after.every((item, index) => item === before[index])) return
  if (syncedFor) {
    const list = projects
    scheduleSave(SAVED_KEY, (keepalive) => upload(list, keepalive))
  } else writeLocal(projects, false)
}

export function useResume() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => projects,
  )
}

/** 계정의 이력서를 받는 중인지 */
export function useResumeLoading() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => loading,
  )
}

export const newId = () => Math.random().toString(36).slice(2, 10)

const lines = (text: string) => text.split('\n').map((line) => line.trim()).filter(Boolean)

/** 메모장이나 이력서 양식에 붙여 넣는 글이에요. */
export function toPlainText(list: ResumeProject[]): string {
  const L = pick(RESUME_LABELS)
  return (
    list
      .map((project) => {
        const out = [`${project.headline} <${project.name}>${project.kind || project.period ? `    ${[project.kind, project.period].filter(Boolean).join(' | ')}` : ''}`]
        if (project.summary) out.push(project.summary)
        if (project.role) out.push(`- ${L.role}  ${project.role}`)
        if (project.stack.length) out.push(`- ${L.stack}  ${project.stack.join(', ')}`)
        for (const problem of project.problems) {
          out.push(`- ${problem.title}`)
          for (const field of PROBLEM_FIELDS) {
            const [first, ...rest] = lines(problem[field])
            if (!first) continue
            out.push(`    - ${L[field]}  ${first}`, ...rest.map((line) => `        ${line}`))
          }
        }
        return out.join('\n')
      })
      .join('\n\n') + '\n'
  )
}

const escapeMarkdown = (text: string) => text.replace(/([\\`*_<>])/g, '\\$1')

/** 노션이나 깃허브에 붙여 넣는 마크다운이에요. */
export function toMarkdown(list: ResumeProject[]): string {
  const L = pick(RESUME_LABELS)
  return (
    list
      .map((project) => {
        const out = [`### ${escapeMarkdown(`${project.headline} <${project.name}>`)}`]
        const meta = [project.kind, project.period].filter(Boolean).join(' | ')
        if (meta) out.push('', meta)
        if (project.summary) out.push('', escapeMarkdown(project.summary))
        out.push('')
        if (project.role) out.push(`- **${L.role}** ${escapeMarkdown(project.role)}`)
        if (project.stack.length) out.push(`- **${L.stack}** ${escapeMarkdown(project.stack.join(', '))}`)
        for (const problem of project.problems) {
          out.push(`- **${escapeMarkdown(problem.title)}**`)
          for (const field of PROBLEM_FIELDS) {
            const [first, ...rest] = lines(problem[field])
            if (!first) continue
            out.push(`  - **${L[field]}** ${escapeMarkdown(first)}${rest.map((line) => `<br>${escapeMarkdown(line)}`).join('')}`)
          }
        }
        return out.join('\n')
      })
      .join('\n\n') + '\n'
  )
}

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** 워드, 구글 문서, 노션에 서식을 지킨 채로 붙여 넣는 HTML이에요. 모양은 화면의 미리보기와 맞춰요. */
export function toHtml(list: ResumeProject[]): string {
  const L = pick(RESUME_LABELS)
  const label = (text: string, color: string) => `<span style="color:${color};display:inline-block;min-width:72px">${escapeHtml(text)}</span> `
  return list
    .map((project) => {
      const meta = [project.kind, project.period].filter(Boolean).join(' | ')
      const items: string[] = []
      if (project.role) items.push(`<li>${label(L.role, '#1570EF')}${escapeHtml(project.role)}</li>`)
      if (project.stack.length) items.push(`<li>${label(L.stack, '#1570EF')}${escapeHtml(project.stack.join(', '))}</li>`)
      for (const problem of project.problems) {
        const rows = PROBLEM_FIELDS.filter((field) => problem[field].trim()).map(
          (field) => `<li>${label(L[field], '#1570EF')}${lines(problem[field]).map(escapeHtml).join('<br>')}</li>`,
        )
        items.push(`<li><b>${escapeHtml(problem.title)}</b><ul>${rows.join('')}</ul></li>`)
      }
      return (
        `<p><b>${escapeHtml(`${project.headline} <${project.name}>`)}</b>${meta ? `&nbsp;&nbsp;<span style="color:#667085">${escapeHtml(meta)}</span>` : ''}</p>` +
        (project.summary ? `<p style="color:#667085">${escapeHtml(project.summary)}</p>` : '') +
        `<ul>${items.join('')}</ul>`
      )
    })
    .join('<br>')
}
