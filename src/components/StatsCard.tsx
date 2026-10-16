import type { ContributorStats } from '../../shared/types'
import { messages, useMessages } from '../lib/i18n'

const TEXT = messages({
  ko: {
    rank: (rank: number) => `${rank}위`,
    commits: '커밋 수',
    count: (value: string) => `${value}개`,
    lines: '추가 / 삭제 라인',
    byCommits: '기여도 (커밋 수 기준)',
    byLines: '기여도 (라인 수 기준)',
  },
  en: {
    rank: (rank: number) => `#${rank}`,
    commits: 'Commits',
    count: (value: string) => value,
    lines: 'Lines added / removed',
    byCommits: 'Share by commits',
    byLines: 'Share by lines',
  },
})

const format = (value: number) => value.toLocaleString('ko-KR')

export function Avatar({ contributor, className }: { contributor: ContributorStats; className: string }) {
  return contributor.avatarUrl ? (
    <img src={contributor.avatarUrl} alt="" loading="lazy" className={`${className} rounded-full bg-gray-100`} />
  ) : (
    <span className={`${className} flex items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-500`}>
      {contributor.name.slice(0, 1).toUpperCase()}
    </span>
  )
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-1 text-[15px] font-semibold text-gray-900 tabular-nums">{children}</dd>
    </div>
  )
}

export function StatsCard({ contributor, rank }: { contributor: ContributorStats; rank: number }) {
  const text = useMessages(TEXT)
  return (
    <div className="h-full rounded-xl bg-white p-4">
      <div className="flex items-center gap-2.5">
        <span className="shrink-0 text-xs font-semibold text-brand tabular-nums">{text.rank(rank)}</span>
        <Avatar contributor={contributor} className="size-8" />
        {contributor.profileUrl ? (
          <a
            href={contributor.profileUrl}
            target="_blank"
            rel="noreferrer"
            className="truncate text-[15px] font-semibold text-gray-900 hover:text-brand"
          >
            {contributor.name}
          </a>
        ) : (
          <span className="truncate text-[15px] font-semibold text-gray-900">{contributor.name}</span>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
        <Stat label={text.commits}>{text.count(format(contributor.commits))}</Stat>
        <Stat label={text.lines}>
          +{format(contributor.additions)} <span className="font-normal text-gray-300">/</span>{' '}
          <span className="text-gray-500">-{format(contributor.deletions)}</span>
        </Stat>
        <Stat label={text.byCommits}>
          <span className="text-brand">{contributor.commitShare}%</span>
        </Stat>
        <Stat label={text.byLines}>
          <span className="text-brand">{contributor.lineShare}%</span>
        </Stat>
      </dl>
    </div>
  )
}
