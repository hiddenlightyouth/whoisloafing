import type { ContributorStats } from '../../shared/types'
import { Avatar } from './StatsCard'

function Bar({ label, value, muted = false }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-7 shrink-0 text-[11px] text-gray-400">{label}</span>
      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${muted ? 'bg-brand/40' : 'bg-brand'}`}
          style={{ width: `${Math.min(100, Math.max(value, value > 0 ? 1.5 : 0))}%` }}
        />
      </div>
      <span className="w-12 shrink-0 text-right text-xs text-gray-700 tabular-nums">{value}%</span>
    </div>
  )
}

interface Props {
  contributors: ContributorStats[]
  othersCount: number
}

export function SummaryChart({ contributors, othersCount }: Props) {
  return (
    <div className="mt-3 rounded-xl bg-white p-4">
      <ul className="space-y-4">
        {contributors.map((contributor) => (
          <li key={`${contributor.login ?? ''}:${contributor.name}`}>
            <div className="mb-1.5 flex items-center gap-2">
              <Avatar contributor={contributor} className="size-5" />
              <span className="truncate text-[13px] font-medium text-gray-900">{contributor.name}</span>
            </div>
            <div className="space-y-1">
              <Bar label="커밋" value={contributor.commitShare} />
              <Bar label="라인" value={contributor.lineShare} muted />
            </div>
          </li>
        ))}
      </ul>
      {othersCount > 0 && (
        <p className="mt-4 text-xs text-gray-400">기여도가 낮은 {othersCount.toLocaleString('ko-KR')}명은 그래프에서 생략했어요.</p>
      )}
    </div>
  )
}
