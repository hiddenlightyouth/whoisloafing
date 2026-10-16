import { useCallback, useState } from 'react'
import { track } from '../lib/analytics'
import { deleteAdminChat, fetchAdminChats, unshareAdminChat, type AdminChat, type AdminChatFilter } from '../lib/admin'
import { formatWhen } from '../lib/format'
import { showToast } from '../lib/toast'
import { tag } from './DeepParts'
import { ConfirmDialog } from './Dialog'
import { Empty, Failed, full, MoreButton, rowButton, RowsSkeleton, SearchBox, Segmented, tableWrap, td, th, useDebounced, usePaged } from './AdminParts'
import { messages, pick, useMessages } from '../lib/i18n'

const TEXT = messages({
  ko: {
    filters: [['ALL', '전체'], ['SHARED', '공유 중'], ['ANONYMOUS', '비회원']] as [AdminChatFilter, string][],
    deleted: '채팅을 지웠어요.',
    unshared: '공유를 취소했어요. 이제 링크로 열 수 없어요.',
    search: '레포나 회원으로 찾기',
    kind: '채팅 종류',
    empty: '조건에 맞는 채팅이 없어요.',
    repo: '레포',
    member: '회원',
    messages: '말풍선',
    updated: '마지막 작업',
    created: '만든 때',
    manage: '관리',
    shared: '공유 중',
    guest: '비회원',
    removedUser: '지워진 회원',
    open: '열기',
    unshare: '공유 취소',
    remove: '지우기',
    deleteTitle: '이 채팅을 지울까요?',
    deleteBody: (repo: string, member: boolean, shared: boolean) =>
      `${repo} 분석 채팅을 지워요. ${member ? '회원의 내 작업에서도 사라지고, ' : ''}${shared ? '공유한 링크도 더 이상 열리지 않아요. ' : ''}지운 채팅은 되돌릴 수 없어요.`,
    unshareTitle: '공유를 취소할까요?',
    unshareBody: (repo: string) => `${repo} 분석 채팅의 공유 링크가 더 이상 열리지 않아요. 채팅은 지워지지 않고, 회원이 다시 공유할 수 있어요.`,
  },
  en: {
    filters: [['ALL', 'All'], ['SHARED', 'Shared'], ['ANONYMOUS', 'Guests']],
    deleted: 'Chat deleted.',
    unshared: 'Sharing stopped. The link no longer opens.',
    search: 'Search by repo or member',
    kind: 'Chat type',
    empty: 'No chats match.',
    repo: 'Repo',
    member: 'Member',
    messages: 'Messages',
    updated: 'Last activity',
    created: 'Created',
    manage: 'Manage',
    shared: 'Shared',
    guest: 'Guest',
    removedUser: 'Deleted member',
    open: 'Open',
    unshare: 'Stop sharing',
    remove: 'Delete',
    deleteTitle: 'Delete this chat?',
    deleteBody: (repo: string, member: boolean, shared: boolean) =>
      `The analysis chat for ${repo} will be deleted. ${member ? "It will also disappear from the member's history. " : ''}${shared ? 'The shared link will stop working. ' : ''}This can't be undone.`,
    unshareTitle: 'Stop sharing?',
    unshareBody: (repo: string) => `The shared link to the ${repo} analysis chat will stop working. The chat stays, and the member can share it again.`,
  },
})

/** 관리자 화면의 채팅 탭이에요. 서비스의 모든 채팅을 보고, 공유를 취소하거나 지워요. 공유되지 않은 채팅의 내용은 열 수 없어요. */
export function AdminChats({ onOpenChat }: { onOpenChat: (id: string) => void }) {
  const L = useMessages(TEXT)
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
    showToast(action === 'delete' ? pick(TEXT).deleted : pick(TEXT).unshared)
    list.refresh()
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={query} onChange={setQuery} placeholder={L.search} />
        <Segmented label={L.kind} options={L.filters} value={filter} onChange={setFilter} />
      </div>

      {list.items === null ? (
        list.error ? (
          <Failed message={list.error} onRetry={list.retry} />
        ) : (
          <RowsSkeleton />
        )
      ) : list.items.length === 0 ? (
        <Empty>{L.empty}</Empty>
      ) : (
        <>
          <div className={tableWrap}>
            <table className="w-full min-w-[760px] text-[13px] text-gray-700 tabular-nums">
              <thead>
                <tr>
                  <th className={th}>{L.repo}</th>
                  <th className={th}>{L.member}</th>
                  <th className={`${th} text-right`}>{L.messages}</th>
                  <th className={th}>{L.updated}</th>
                  <th className={th}>{L.created}</th>
                  <th className={th}>
                    <span className="sr-only">{L.manage}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((chat) => (
                  <tr key={chat.id} className="border-t border-gray-100">
                    <td className={td}>
                      <span className="flex items-center gap-2">
                        <span className="max-w-[240px] truncate font-semibold text-gray-900">{chat.repoName}</span>
                        {chat.shared && <span className={`${tag} shrink-0 text-brand-hover`}>{L.shared}</span>}
                      </span>
                    </td>
                    <td className={td}>
                      {chat.userId === null ? (
                        <span className="text-gray-400">{L.guest}</span>
                      ) : (
                        <>
                          <p className="max-w-[200px] truncate text-gray-900">{chat.userName ?? L.removedUser}</p>
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
                              {L.open}
                            </button>
                            <button type="button" onClick={() => setAsking({ chat, action: 'unshare' })} className={rowButton}>
                              {L.unshare}
                            </button>
                          </>
                        )}
                        <button type="button" onClick={() => setAsking({ chat, action: 'delete' })} className={`${rowButton} text-red-500 hover:text-red-600`}>
                          {L.remove}
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
            title={L.deleteTitle}
            body={L.deleteBody(asking.chat.repoName, asking.chat.userId !== null, asking.chat.shared)}
            confirm={L.remove}
            danger
            working={working}
            onCancel={cancel}
            onConfirm={() => void run()}
          />
        ) : (
          <ConfirmDialog
            title={L.unshareTitle}
            body={L.unshareBody(asking.chat.repoName)}
            confirm={L.unshare}
            working={working}
            onCancel={cancel}
            onConfirm={() => void run()}
          />
        ))}
    </>
  )
}
