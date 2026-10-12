import { useEffect, useState } from 'react'
import { parseRepoUrl } from '../../shared/repo'
import { DEEP_SECTIONS, type DeepReport, type DeepSection } from '../../shared/types'
import { track } from '../lib/analytics'
import { fetchDeepReport } from '../lib/api'
import { Forms } from './Forms'
import { Pipeline } from './Pipeline'
import { RepoInput } from './RepoInput'
import { RichText } from './RichText'
import { Bone } from './Skeleton'
import { StructureMap } from './StructureMap'

interface Props {
  /** 살펴볼 레포(소유자/레포). null이면 레포를 고르는 화면이에요. */
  repo: string | null
  /** 다른 레포를 열거나(소유자/레포), 레포를 고르는 화면으로 돌아가요(null). */
  onOpen: (repo: string | null) => void
}

const SECTION_LABELS: Record<DeepSection, string> = {
  structure: '프로젝트 구조',
  pipeline: 'CI/CD',
  issues: '이슈 템플릿과 라벨',
  pulls: 'PR 템플릿',
}

type Loaded = { report: DeepReport } | { error: string }

/**
 * 앱에서만 쓰는 심층 분석 화면이에요. 채팅처럼 말풍선이 쌓이지 않고, 레포 하나를 탭으로 나눠 한 화면에서 살펴봐요.
 * 탭은 처음 열 때 한 번만 받아 두고, 다른 탭에 다녀와도 다시 받지 않아요.
 */
export function Deep({ repo, onOpen }: Props) {
  if (!repo) return <Start onOpen={onOpen} />
  // 레포가 바뀌면 받아 둔 내용과 보던 탭을 처음으로 되돌려요.
  return <Dashboard key={repo} repo={repo} onOpen={onOpen} />
}

function Start({ onOpen }: { onOpen: (repo: string) => void }) {
  return (
    <main className="flex flex-1 items-center justify-center px-5">
      <div className="w-full max-w-lg">
        <h1 className="text-center text-[24px] leading-snug font-semibold text-gray-900 sm:text-[30px]">심층 분석 시작하기</h1>
        <p className="mt-3 mb-7 text-center text-[13px] leading-relaxed text-balance break-keep text-gray-500 sm:mb-8 sm:text-[14px]">
          GitHub Repository 링크를 입력하면 프로젝트 구조, CI/CD 파이프라인, 이슈와 PR 템플릿을 한 화면에서 살펴볼 수 있어요
        </p>
        <RepoInput
          onSubmit={(url) => {
            const parsed = parseRepoUrl(url)
            if (!parsed) return
            track('deep_submit', { repo: `${parsed.owner}/${parsed.repo}` })
            onOpen(`${parsed.owner}/${parsed.repo}`)
          }}
        />
      </div>
    </main>
  )
}

function Dashboard({ repo, onOpen }: { repo: string; onOpen: (repo: string | null) => void }) {
  const [section, setSection] = useState<DeepSection>('structure')
  const [loaded, setLoaded] = useState<Partial<Record<DeepSection, Loaded>>>({})
  /** 다시 시도하기를 누르면 숫자를 올려서 같은 탭을 한 번 더 받아요. */
  const [attempt, setAttempt] = useState(0)
  const current = loaded[section]

  useEffect(() => {
    if (current) return
    let stale = false
    void fetchDeepReport(repo, section).then((result) => {
      if (!stale) setLoaded((prev) => ({ ...prev, [section]: result }))
    })
    return () => {
      stale = true
    }
    // 받아 둔 탭은 다시 받지 않아요.
  }, [repo, section, attempt, current])

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
            다른 레포 살펴보기
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
          <Loading />
        ) : 'error' in current ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-[14px] leading-relaxed text-gray-600">{current.error}</p>
            <button
              type="button"
              onClick={() => {
                setLoaded((prev) => ({ ...prev, [section]: undefined }))
                setAttempt((value) => value + 1)
              }}
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
