import { useCallback, useState } from 'react'
import { track } from '../lib/analytics'
import { deleteAdminChat, fetchAdminChats, unshareAdminChat, type AdminChat, type AdminChatFilter } from '../lib/admin'
import { formatWhen } from '../lib/format'
import { showToast } from '../lib/toast'
import { tag } from './DeepParts'
import { ConfirmDialog, Empty, Failed, full, MoreButton, rowButton, RowsSkeleton, SearchBox, Segmented, tableWrap, td, th, useDebounced, usePaged } from './AdminParts'

const FILTERS: [AdminChatFilter, string][] = [
  ['ALL', '전체'],
  ['SHARED', '공유 중'],
  ['ANONYMOUS', '비회원'],
]

/** 관리자 화면의 채팅 탭이에요. 서비스의 모든 채팅을 보고, 공유를 취소하거나 지워요. 공유되지 않은 채팅의 내용은 열 수 없어요. */
export function AdminChats({ onOpenChat }: { onOpenChat: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<AdminChatFilter>('ALL')
  const keyword = useDebounced(query)
  const list = usePaged<AdminChat>((page) => fetchAdminChats(keyword, filter, page), `${keyword}:${filter}`)
  const [asking, setAsking] = useState<{ chat: AdminChat; action: 'unshare' | 'delete' } | null>(null)
  const [working, setWorking] = useState(false)
  const cancel = useCallback(() => setAsking(null), [])

  async function run() {
    if (!asking) return
    const { chat, action } = asking
    setWorking(true)
    const result = await (action === 'delete' ? deleteAdminChat(chat.id) : unshareAdminChat(chat.id))
    setWorking(false)
    track('admin_chat_action', { action, success: result.ok })
    if (!result.ok) {
      showToast(result.message)
      return
    }
    setAsking(null)
    showToast(action === 'delete' ? '채팅을 지웠어요.' : '공유를 취소했어요. 이제 링크로 열 수 없어요.')
    list.refresh()
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={query} onChange={setQuery} placeholder="레포나 회원으로 찾기" />
        <Segmented label="채팅 종류" options={FILTERS} value={filter} onChange={setFilter} />
      </div>

      {list.items === null ? (
        list.error ? (
          <Failed message={list.error} onRetry={list.retry} />
        ) : (
          <RowsSkeleton />
        )
      ) : list.items.length === 0 ? (
        <Empty>조건에 맞는 채팅이 없어요.</Empty>
      ) : (
        <>
          <div className={tableWrap}>
            <table className="w-full min-w-[760px] text-[13px] text-gray-700 tabular-nums">
              <thead>
                <tr>
                  <th className={th}>레포</th>
                  <th className={th}>회원</th>
                  <th className={`${th} text-right`}>말풍선</th>
                  <th className={th}>마지막 작업</th>
                  <th className={th}>만든 때</th>
                  <th className={th}>
                    <span className="sr-only">관리</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((chat) => (
                  <tr key={chat.id} className="border-t border-gray-100">
                    <td className={td}>
                      <span className="flex items-center gap-2">
                        <span className="max-w-[240px] truncate font-semibold text-gray-900">{chat.repoName}</span>
                        {chat.shared && <span className={`${tag} shrink-0 text-brand-hover`}>공유 중</span>}
                      </span>
                    </td>
                    <td className={td}>
                      {chat.userId === null ? (
                        <span className="text-gray-400">비회원</span>
                      ) : (
                        <>
                          <p className="max-w-[200px] truncate text-gray-900">{chat.userName ?? '지워진 회원'}</p>
                          <p className="mt-0.5 max-w-[200px] truncate text-[12px] text-gray-400">{chat.userEmail ?? ''}</p>
                        </>
                      )}
                    </td>
                    <td className={`${td} text-right`}>{full(chat.messageCount)}</td>
                    <td className={`${td} whitespace-nowrap text-gray-500`}>{formatWhen(chat.updatedAt)}</td>
                    <td className={`${td} whitespace-nowrap text-gray-500`}>{formatWhen(chat.createdAt)}</td>
                    <td className={td}>
                      <span className="flex justify-end gap-0.5">
                        {chat.shared && (
                          <>
                            <button type="button" onClick={() => onOpenChat(chat.id)} className={rowButton}>
                              열기
                            </button>
                            <button type="button" onClick={() => setAsking({ chat, action: 'unshare' })} className={rowButton}>
                              공유 취소
                            </button>
                          </>
                        )}
                        <button type="button" onClick={() => setAsking({ chat, action: 'delete' })} className={`${rowButton} text-red-500 hover:text-red-600`}>
                          지우기
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {list.hasNext && <MoreButton loading={list.loadingMore} onClick={() => void list.more()} />}
        </>
      )}

      {asking &&
        (asking.action === 'delete' ? (
          <ConfirmDialog
            title="이 채팅을 지울까요?"
            body={`${asking.chat.repoName} 분석 채팅을 지워요. ${asking.chat.userId === null ? '' : '회원의 내 작업에서도 사라지고, '}${asking.chat.shared ? '공유한 링크도 더 이상 열리지 않아요. ' : ''}지운 채팅은 되돌릴 수 없어요.`}
            confirm="지우기"
            danger
            working={working}
            onCancel={cancel}
            onConfirm={() => void run()}
          />
        ) : (
          <ConfirmDialog
            title="공유를 취소할까요?"
            body={`${asking.chat.repoName} 분석 채팅의 공유 링크가 더 이상 열리지 않아요. 채팅은 지워지지 않고, 회원이 다시 공유할 수 있어요.`}
            confirm="공유 취소"
            working={working}
            onCancel={cancel}
            onConfirm={() => void run()}
          />
        ))}
    </>
  )
}
