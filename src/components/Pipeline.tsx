import { Fragment } from 'react'
import type { Workflow, WorkflowJob } from '../../shared/types'
import { Source, tag } from './DeepParts'
import { messages, useMessages } from '../lib/i18n'

const TEXT = messages({
  ko: { trigger: '작동 조건', unreadable: '이 파일은 흐름으로 읽지 못했어요. 아래 원문을 확인해 주세요.' },
  en: { trigger: 'Runs on', unreadable: "This file couldn't be read as a flow. Check the source below." },
})

/**
 * CI/CD 파이프라인을 흐름으로 보여줘요.
 * 작동 조건을 먼저 보여주고, 그 아래에 먼저 도는 작업부터 왼쪽에서 오른쪽으로 늘어놓아요. 같은 칸에 있는 작업은 동시에 돌아요.
 * 아래의 원문에는 작업이 시작되는 줄마다 같은 번호를 붙여서, 어느 부분이 몇 번째로 도는지 바로 알 수 있어요.
 */
export function Pipeline({ workflow }: { workflow: Workflow }) {
  const L = useMessages(TEXT)
  const marks: Record<number, number> = {}
  workflow.stages.forEach((jobs, stage) => {
    for (const job of jobs) if (job.line) marks[job.line] = stage + 1
  })
  // 단계가 하나뿐이면 순서를 따질 것이 없어서 원문에 번호를 붙이지 않아요.
  const staged = workflow.stages.length > 1

  return (
    <div className="space-y-4">
      {workflow.triggers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[13px] font-medium text-gray-500">{L.trigger}</span>
          {workflow.triggers.map((trigger) => (
            <span key={trigger} className={tag}>
              {trigger}
            </span>
          ))}
        </div>
      )}

      {workflow.stages.length > 0 ? (
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-stretch sm:overflow-x-auto sm:pb-1">
          {workflow.stages.map((jobs, stage) => (
            <Fragment key={stage}>
              {stage > 0 && <Connector />}
              <div className="flex min-w-0 flex-1 flex-col gap-3 sm:min-w-[260px]">
                {jobs.map((job, item) => (
                  <Job key={`${item}:${job.name}`} job={job} order={stage + 1} />
                ))}
              </div>
            </Fragment>
          ))}
        </div>
      ) : (
        <p className="text-[13.5px] text-gray-500">{L.unreadable}</p>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <Source path={workflow.path} content={workflow.content} kind="pipeline" marks={staged ? marks : undefined} />
      </div>
    </div>
  )
}

function Job({ job, order }: { job: WorkflowJob; order: number }) {
  return (
    <section className="flex-1 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-[12px] font-semibold text-white tabular-nums">
          {order}
        </span>
        <h4 className="min-w-0 truncate text-[14.5px] font-semibold text-gray-900">{job.name}</h4>
      </div>
      {job.runsOn && <p className="mt-1.5 truncate font-mono text-[12px] tracking-normal text-gray-400">{job.runsOn}</p>}
      {job.steps.length > 0 && (
        <ol className="mt-3.5 space-y-2.5">
          {job.steps.map((step, index) => (
            <li key={`${index}:${step.name}`} className="flex gap-2.5 text-[13.5px] leading-snug">
              <span className="mt-[8px] size-1 shrink-0 rounded-full bg-gray-300" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-gray-800">{step.name}</span>
                {step.detail && <span className="mt-0.5 block font-mono text-[12px] tracking-normal break-all text-gray-400">{step.detail}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

/** 앞 단계가 끝나야 다음 단계가 돈다는 것을 선으로 이어서 보여줘요. */
function Connector() {
  return (
    <div className="flex shrink-0 items-center justify-center text-gray-300 sm:w-6" aria-hidden="true">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-4 rotate-90 sm:rotate-0">
        <path d="M2 8h11M9.5 4.5L13 8l-3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
