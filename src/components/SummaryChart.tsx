import type { ContributorStats } from '../../shared/types'
import { Avatar } from './StatsCard'

interface GroupProps {
  title: string
  contributors: ContributorStats[]
  value: (contributor: ContributorStats) => number
}

/** 한 가지 기준으로 모든 참여자를 한 줄씩 나란히 비교해요. */
function Group({ title, contributors, value }: GroupProps) {
  return (
    <section>
      <h3 className="text-xs font-medium text-gray-500">{title}</h3>
      <ul className="mt-2.5 space-y-2">
        {contributors.map((contributor) => {
          const share = value(contributor)
          return (
            <li key={`${contributor.login ?? ''}:${contributor.name}`} className="flex items-center gap-2">
              <Avatar contributor={contributor} className="size-5 shrink-0" />
              <span className="w-20 shrink-0 truncate text-[13px] text-gray-900 sm:w-24">{contributor.name}</span>
              <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${Math.min(100, Math.max(share, share > 0 ? 1.5 : 0))}%` }}
                />
              </div>
              <span className="w-11 shrink-0 text-right text-xs text-gray-700 tabular-nums">{share}%</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

interface Props {
  contributors: ContributorStats[]
  othersCount: number
}

export function SummaryChart({ contributors, othersCount }: Props) {
  return (
    <div className="mt-3 space-y-5 rounded-xl bg-white p-4">
      <Group title="커밋 수 기준" contributors={contributors} value={(contributor) => contributor.commitShare} />
      <Group title="라인 수 기준" contributors={contributors} value={(contributor) => contributor.lineShare} />
      {othersCount > 0 && (
        <p className="text-xs text-gray-400">기여도가 낮은 {othersCount.toLocaleString('ko-KR')}명은 그래프에서 생략했어요.</p>
      )}
    </div>
  )
}
