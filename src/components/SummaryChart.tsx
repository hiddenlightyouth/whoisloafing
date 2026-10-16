import type { ContributorStats } from '../../shared/types'
import { Avatar } from './StatsCard'
import { messages, useMessages } from '../lib/i18n'

const TEXT = messages({
  ko: {
    byCommits: '커밋 수 기준',
    byLines: '라인 수 기준',
    others: (count: number) => `기여도가 낮은 ${count.toLocaleString('ko-KR')}명은 그래프에서 생략했어요.`,
    trust: '기여도 숫자는 판결이 아니라 참고할 신호예요. 더 나은 대화를 위한 맥락으로 봐 주세요.',
  },
  en: {
    byCommits: 'By commits',
    byLines: 'By lines changed',
    others: (count: number) => `${count.toLocaleString('en-US')} contributors with smaller shares are hidden from the chart.`,
    trust: "Contribution numbers are signals, not verdicts. Use them as context for better conversations, not as the only measure of someone's work.",
  },
})

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
                  className="h-full origin-left animate-grow rounded-full bg-brand"
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
  const text = useMessages(TEXT)
  return (
    <div className="mt-3 space-y-5 rounded-xl bg-white p-4">
      <Group title={text.byCommits} contributors={contributors} value={(contributor) => contributor.commitShare} />
      <Group title={text.byLines} contributors={contributors} value={(contributor) => contributor.lineShare} />
      <p className="text-xs leading-relaxed text-gray-400">{text.trust}</p>
      {othersCount > 0 && (
        <p className="text-xs text-gray-400">{text.others(othersCount)}</p>
      )}
    </div>
  )
}
