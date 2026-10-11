import { Fragment, useState } from 'react'
import type { Workflow, WorkflowJob } from '../../shared/types'
import { Source, Tabs } from './Expand'

interface Props {
  workflows: Workflow[]
  /** 크게 보기 창 안이면 true. 단계를 줄이지 않고 다 보여주고, 원문도 함께 보여줘요. */
  large: boolean
}

/** 말풍선 안에서는 작업마다 단계를 이만큼만 보여줘요. */
const COMPACT_STEPS = 4

/**
 * CI/CD 파이프라인을 흐름으로 보여줘요.
 * 언제 도는지를 먼저 보여주고, 그 아래에 먼저 도는 작업부터 왼쪽에서 오른쪽으로 늘어놓아요.
 * 같은 칸에 있는 작업은 동시에 돌아요. 좁은 화면에서는 위에서 아래로 늘어놓아요.
 */
export function Pipeline({ workflows, large }: Props) {
  const [index, setIndex] = useState(0)
  const workflow = workflows[Math.min(index, workflows.length - 1)]
  if (!workflow) return null

  return (
    <div>
      <Tabs names={workflows.map((item) => item.name)} index={index} onSelect={setIndex} />

      {workflow.triggers.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-[12px] text-gray-500">이럴 때 돌아요</span>
          {workflow.triggers.map((trigger) => (
            <span key={trigger} className="rounded-full bg-brand-soft px-2.5 py-1 text-[12px] leading-none font-medium text-brand-hover">
              {trigger}
            </span>
          ))}
        </div>
      )}

      {workflow.stages.length > 0 ? (
        <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-stretch sm:overflow-x-auto sm:pb-1">
          {workflow.stages.map((jobs, stage) => (
            <Fragment key={stage}>
              {stage > 0 && <Connector />}
              <div className={`flex min-w-0 flex-1 flex-col gap-2 ${large ? 'sm:min-w-[240px]' : 'sm:min-w-[190px]'}`}>
                {jobs.map((job, item) => (
                  <Job key={`${item}:${job.name}`} job={job} order={stage + 1} large={large} />
                ))}
              </div>
            </Fragment>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-gray-500">이 파일은 흐름으로 읽지 못했어요. {large ? '아래 원문을 확인해 주세요.' : '크게 보기에서 원문을 확인해 주세요.'}</p>
      )}

      {large ? (
        <div className="mt-5">
          <Source path={workflow.path} content={workflow.content} kind="pipeline" tall />
        </div>
      ) : (
        <p className="mt-3 font-mono text-[12px] tracking-normal break-all text-gray-400">{workflow.path}</p>
      )}
    </div>
  )
}

function Job({ job, order, large }: { job: WorkflowJob; order: number; large: boolean }) {
  const steps = large ? job.steps : job.steps.slice(0, COMPACT_STEPS)
  const hidden = job.steps.length - steps.length

  return (
    <section className="flex-1 rounded-lg border border-gray-200 px-3 pt-2.5 pb-3">
      <div className="flex items-center gap-2">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-white tabular-nums">
          {order}
        </span>
        <h4 className="min-w-0 truncate text-[13.5px] font-semibold text-gray-900">{job.name}</h4>
      </div>
      {job.runsOn && <p className="mt-1 truncate font-mono text-[11px] tracking-normal text-gray-400">{job.runsOn}</p>}
      {steps.length > 0 && (
        <ol className="mt-2 space-y-1.5">
          {steps.map((step, index) => (
            <li key={`${index}:${step.name}`} className="flex gap-2 text-[13px] leading-snug">
              <span className="mt-[7px] size-1 shrink-0 rounded-full bg-gray-300" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-gray-700">{step.name}</span>
                {large && step.detail && (
                  <span className="block font-mono text-[11.5px] tracking-normal break-all text-gray-400">{step.detail}</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
      {hidden > 0 && <p className="mt-1.5 pl-3 text-[12px] text-gray-400">그 뒤로 {hidden}단계 더 있어요</p>}
    </section>
  )
}

/** 앞 단계가 끝나야 다음 단계가 돈다는 것을 선으로 이어서 보여줘요. */
function Connector() {
  return (
    <div className="flex shrink-0 items-center justify-center text-gray-300 sm:w-5" aria-hidden="true">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-4 rotate-90 sm:rotate-0">
        <path d="M2 8h11M9.5 4.5L13 8l-3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
