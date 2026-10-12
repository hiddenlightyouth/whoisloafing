import { useEffect, useState } from 'react'
import { DEVICE_LABELS, fetchAdminFeedback, fetchFeedbackSummary, type AdminFeedback as Item, type FeedbackSummary } from '../lib/admin'
import { formatDateTime } from '../lib/format'
import { tag } from './DeepParts'
import { Empty, Failed, full, MoreButton, rowButton, RowsSkeleton, Segmented, share, Stat, StatsSkeleton, tableWrap, td, th, usePaged } from './AdminParts'

type Filter = 'ALL' | 'RATING' | 'BUG'

const FILTERS: [Filter, string][] = [
  ['ALL', '전체'],
  ['RATING', '평가'],
  ['BUG', '버그 신고'],
]

function KindTag({ item }: { item: Item }) {
  if (item.kind === 'BUG') return <span className={`${tag} text-red-500`}>버그 신고</span>
  return item.rating === 'BAD' ? <span className={tag}>아쉬웠어요</span> : <span className={`${tag} text-brand-hover`}>좋았어요</span>
}

/** 관리자 화면의 피드백 탭이에요. 사용자가 보낸 평가와 버그 신고를 최근 순서로 봐요. */
export function AdminFeedback({ onOpenChat }: { onOpenChat: (id: string) => void }) {
  const [filter, setFilter] = useState<Filter>('ALL')
  const [summary, setSummary] = useState<FeedbackSummary | null>(null)
  const list = usePaged<Item>((page) => fetchAdminFeedback(filter, page), filter)

  useEffect(() => {
    let stale = false
    void fetchFeedbackSummary().then((result) => {
      if (!stale && result.ok) setSummary(result.data)
    })
    return () => {
      stale = true
    }
  }, [])

  const rated = summary ? summary.good + summary.bad : 0

  return (
    <>
      {summary ? (
        <dl className="grid grid-cols-3 gap-3">
          <Stat label="좋았어요" value={full(summary.good)} note={rated > 0 ? share(summary.good, rated).replace('전체의', '평가의') : undefined} />
          <Stat label="아쉬웠어요" value={full(summary.bad)} note={rated > 0 ? share(summary.bad, rated).replace('전체의', '평가의') : undefined} />
          <Stat label="버그 신고" value={full(summary.bugs)} />
        </dl>
      ) : (
        <div className="-mt-3">
          <StatsSkeleton count={3} />
        </div>
      )}

      <div className="mt-8 flex justify-end">
        <Segmented label="피드백 종류" options={FILTERS} value={filter} onChange={setFilter} />
      </div>

      {list.items === null ? (
        list.error ? (
          <Failed message={list.error} onRetry={list.retry} />
        ) : (
          <RowsSkeleton rows={6} />
        )
      ) : list.items.length === 0 ? (
        <Empty>아직 받은 피드백이 없어요.</Empty>
      ) : (
        <>
          <div className={tableWrap}>
            <table className="w-full min-w-[760px] text-[13px] text-gray-700 tabular-nums">
              <thead>
                <tr>
                  <th className={th}>때</th>
                  <th className={th}>종류</th>
                  <th className={th}>내용</th>
                  <th className={th}>보낸 사람</th>
                  <th className={th}>기기</th>
                  <th className={th}>화면</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((item) => (
                  <tr key={item.id} className="border-t border-gray-100 align-top">
                    <td className={`${td} whitespace-nowrap text-gray-500`}>{formatDateTime(item.createdAt)}</td>
                    <td className={td}>
                      <KindTag item={item} />
                    </td>
                    <td className={`${td} max-w-[360px] leading-relaxed break-words whitespace-pre-wrap text-gray-900`}>{item.comment ?? <span className="text-gray-400">남긴 말이 없어요</span>}</td>
                    <td className={td}>
                      {item.userId === null ? (
                        <span className="text-gray-400">비회원</span>
                      ) : (
                        <>
                          <p className="max-w-[180px] truncate text-gray-900">{item.userName ?? '지워진 회원'}</p>
                          <p className="mt-0.5 max-w-[180px] truncate text-[12px] text-gray-400">{item.userEmail ?? ''}</p>
                        </>
                      )}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{DEVICE_LABELS[item.device]}</td>
                    <td className={td}>
                      <p className="max-w-[160px] truncate font-mono text-[12px] tracking-normal text-gray-500" title={item.page ?? undefined}>
                        {item.page ?? ''}
                      </p>
                      {/* 공유되지 않은 채팅은 관리자도 열 수 없어서, 열리지 않으면 열 수 없다는 화면이 나와요. */}
                      {item.chatId && (
                        <button type="button" onClick={() => onOpenChat(item.chatId!)} className={`${rowButton} -ml-2 mt-0.5`}>
                          채팅 열기
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {list.hasNext && <MoreButton loading={list.loadingMore} onClick={() => void list.more()} />}
        </>
      )}
    </>
  )
}
