import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { track } from '../lib/analytics'
import { deleteChat, unshareChat } from '../lib/api'
import { fetchMyChats, useAuth, type ChatSummary } from '../lib/auth'
import { formatWhen } from '../lib/format'
import { showToast } from '../lib/toast'
import { copyChatLink, DeleteDialog } from './History'
import { Bone } from './Skeleton'

interface Props {
  /** 지금 열려 있는 채팅. 목록에서 강조해요. */
  activeChatId: string | null
  /** 지금 보고 있는 화면. 아래쪽 링크를 강조해요. */
  page: 'articles' | 'me' | null
  /** 값이 바뀌면 목록을 다시 받아요. */
  refreshKey: string
  onClose: () => void
  onNew: () => void
  onOpenChat: (id: string) => void
  /** 목록에서 공유를 취소하거나 지웠을 때 불러요. 열려 있는 채팅이면 화면도 맞춰요. */
  onChatChanged: (id: string, change: 'unshared' | 'deleted') => void
  onArticles: () => void
  onMe: () => void
}

const SKELETON_ROWS = ['w-4/5', 'w-3/5', 'w-2/3', 'w-1/2']

const link = 'flex h-9 w-full items-center rounded-xl px-3 text-left text-[13px] font-medium transition-colors'
const tone = (active: boolean) => (active ? 'bg-gray-200/70 text-gray-900' : 'text-gray-600 hover:bg-gray-200/50 hover:text-gray-900')
const menuItem = 'block w-full rounded-xl px-3 py-2 text-left text-[13px] font-medium transition-colors hover:bg-gray-50 disabled:text-gray-400'

const plain = (event: MouseEvent) => !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)

/** 사이드바를 접고 펴는 버튼의 그림이에요. */
function SidebarIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="size-4" aria-hidden="true">
      <rect x="2" y="3" width="12" height="10" rx="2.5" />
      <path d="M6.5 3v10" />
    </svg>
  )
}

interface RowProps {
  chat: ChatSummary
  active: boolean
  menuOpen: boolean
  working: boolean
  onOpen: () => void
  onToggleMenu: () => void
  onCloseMenu: () => void
  onUnshare: () => void
  onDelete: () => void
}

function ChatRow({ chat, active, menuOpen, working, onOpen, onToggleMenu, onCloseMenu, onUnshare, onDelete }: RowProps) {
  const [owner, repo] = chat.repoName.includes('/') ? chat.repoName.split('/') : ['', chat.repoName]
  const menuRef = useRef<HTMLDivElement>(null)

  // 메뉴가 열려 있을 때 바깥을 누르거나 Esc를 누르면 닫아요.
  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onCloseMenu()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseMenu()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen, onCloseMenu])

  return (
    <li className={`group relative flex items-center rounded-xl transition-colors ${tone(active || menuOpen)}`}>
      <a
        href={`/c/${chat.id}`}
        aria-current={active ? 'page' : undefined}
        onClick={(event) => {
          if (!plain(event)) return
          event.preventDefault()
          onOpen()
        }}
        className="min-w-0 flex-1 py-2 pl-3"
      >
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-900">
          {chat.shared && (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-3.5 shrink-0 text-brand" role="img" aria-label="공유한 채팅">
              <path d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2.2-2.2a2.6 2.6 0 0 0-3.7-3.7l-.8.8M9.2 6.8a2.6 2.6 0 0 0-3.7 0L3.3 9a2.6 2.6 0 0 0 3.7 3.7l.8-.8" strokeLinecap="round" />
            </svg>
          )}
          <span className="min-w-0 truncate">{repo}</span>
        </p>
        <p className="mt-0.5 flex items-center justify-between gap-2 text-xs text-gray-400">
          <span className="min-w-0 truncate">{owner}</span>
          <span className="shrink-0">{formatWhen(chat.updatedAt)}</span>
        </p>
      </a>

      <div ref={menuRef} className="shrink-0 pr-1 pl-0.5">
        <button
          type="button"
          aria-label={`${chat.repoName} 채팅 관리`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={onToggleMenu}
          className={`flex size-7 items-center justify-center gap-[3px] rounded-full text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 group-hover:opacity-100 focus-visible:opacity-100 ${menuOpen ? 'opacity-100' : 'opacity-0'}`}
        >
          <span className="size-[3px] rounded-full bg-current" />
          <span className="size-[3px] rounded-full bg-current" />
          <span className="size-[3px] rounded-full bg-current" />
        </button>

        {menuOpen && (
          <div role="menu" className="absolute top-full right-1 z-10 -mt-1 w-36 animate-rise rounded-2xl border border-gray-200 bg-white p-1.5">
            {chat.shared && (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={async () => {
                    onCloseMenu()
                    const ok = await copyChatLink(chat.id)
                    track('share_link_copy', { success: ok, is_owner: true, from: 'sidebar' })
                    showToast(ok ? '링크를 복사했어요.' : '링크를 복사하지 못했어요.')
                  }}
                  className={`${menuItem} text-gray-700`}
                >
                  링크 복사
                </button>
                <button type="button" role="menuitem" disabled={working} onClick={onUnshare} className={`${menuItem} text-gray-700`}>
                  공유 취소
                </button>
              </>
            )}
            <button type="button" role="menuitem" disabled={working} onClick={onDelete} className={`${menuItem} text-red-500`}>
              지우기
            </button>
          </div>
        )}
      </div>
    </li>
  )
}

/** 앱 화면 왼쪽의 사이드바예요. 새 분석, 내 작업 목록과 관리, 아티클과 내 정보로 가는 링크가 있어요. */
export function AppSidebar({ activeChatId, page, refreshKey, onClose, onNew, onOpenChat, onChatChanged, onArticles, onMe }: Props) {
  const { me } = useAuth()
  const [chats, setChats] = useState<ChatSummary[] | null>(null)
  const [nextPage, setNextPage] = useState<number | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<ChatSummary | null>(null)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    let stale = false
    void fetchMyChats(0).then((result) => {
      if (stale) return
      if (!result.ok) {
        setError(result.message)
        return
      }
      setError('')
      setChats(result.data.items)
      setNextPage(result.data.hasNext ? 1 : null)
    })
    return () => {
      stale = true
    }
  }, [refreshKey])

  const closeMenu = useCallback(() => setMenuFor(null), [])
  const cancelDelete = useCallback(() => setDeleting(null), [])

  async function loadMore() {
    if (nextPage === null || loadingMore) return
    setLoadingMore(true)
    const result = await fetchMyChats(nextPage)
    setLoadingMore(false)
    if (!result.ok) {
      showToast(result.message)
      return
    }
    setChats((prev) => {
      const seen = new Set((prev ?? []).map((chat) => chat.id))
      return [...(prev ?? []), ...result.data.items.filter((chat) => !seen.has(chat.id))]
    })
    setNextPage(result.data.hasNext ? nextPage + 1 : null)
  }

  async function unshare(chat: ChatSummary) {
    setMenuFor(null)
    setWorking(true)
    const ok = await unshareChat(chat.id)
    setWorking(false)
    track('chat_unshare', { success: ok, from: 'sidebar' })
    if (!ok) {
      showToast('공유를 취소하지 못했어요. 잠시 뒤에 다시 시도해 주세요.')
      return
    }
    setChats((prev) => prev?.map((item) => (item.id === chat.id ? { ...item, shared: false } : item)) ?? null)
    onChatChanged(chat.id, 'unshared')
    showToast('공유를 취소했어요. 이제 링크로 열 수 없어요.')
  }

  async function remove(chat: ChatSummary) {
    setWorking(true)
    const ok = await deleteChat(chat.id)
    setWorking(false)
    track('chat_delete', { success: ok, shared: chat.shared, from: 'sidebar' })
    if (!ok) {
      showToast('채팅을 지우지 못했어요. 잠시 뒤에 다시 시도해 주세요.')
      return
    }
    setDeleting(null)
    setChats((prev) => prev?.filter((item) => item.id !== chat.id) ?? null)
    onChatChanged(chat.id, 'deleted')
    showToast('채팅을 지웠어요.')
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-gray-200 bg-gray-50">
      <div data-app-drag className="flex h-11 shrink-0 items-center justify-end px-2">
        <button
          type="button"
          aria-label="사이드바 닫기"
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-200/70 hover:text-gray-900"
        >
          <SidebarIcon />
        </button>
      </div>

      <div className="px-3">
        <button
          type="button"
          onClick={onNew}
          className="flex h-10 w-full items-center gap-2 rounded-xl bg-white px-3 text-[13px] font-semibold text-gray-900 ring-1 ring-gray-200 transition-colors hover:text-brand"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="size-4" aria-hidden="true">
            <path d="M8 3v10M3 8h10" />
          </svg>
          새 분석
        </button>
      </div>

      <h2 className="mt-5 px-6 text-xs font-medium text-gray-400">내 작업</h2>

      <nav className="mt-1.5 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {chats === null ? (
          error ? (
            <p className="px-3 py-2 text-[13px] leading-relaxed text-gray-500">{error}</p>
          ) : (
            <ul aria-busy="true">
              <li className="sr-only">불러오고 있어요.</li>
              {SKELETON_ROWS.map((width, index) => (
                <li key={index} aria-hidden className="px-3 py-2.5">
                  <Bone className={`h-3.5 ${width}`} />
                  <Bone className="mt-2 h-3 w-1/3" />
                </li>
              ))}
            </ul>
          )
        ) : chats.length === 0 ? (
          <p className="px-3 py-2 text-[13px] leading-relaxed text-gray-500">아직 분석한 레포가 없어요.</p>
        ) : (
          <ul className="space-y-0.5">
            {chats.map((chat) => (
              <ChatRow
                key={chat.id}
                chat={chat}
                active={chat.id === activeChatId}
                menuOpen={menuFor === chat.id}
                working={working}
                onOpen={() => onOpenChat(chat.id)}
                onToggleMenu={() => setMenuFor((open) => (open === chat.id ? null : chat.id))}
                onCloseMenu={closeMenu}
                onUnshare={() => void unshare(chat)}
                onDelete={() => {
                  setMenuFor(null)
                  setDeleting(chat)
                }}
              />
            ))}
            {nextPage !== null && (
              <li>
                <button type="button" disabled={loadingMore} onClick={() => void loadMore()} className={`${link} ${tone(false)} disabled:text-gray-400`}>
                  {loadingMore ? '처리 중' : '더 보기'}
                </button>
              </li>
            )}
          </ul>
        )}
      </nav>

      <div className="shrink-0 border-t border-gray-200 p-3">
        <a
          href="/articles"
          onClick={(event) => {
            if (!plain(event)) return
            event.preventDefault()
            onArticles()
          }}
          className={`${link} ${tone(page === 'articles')}`}
        >
          아티클
        </a>
        <a
          href="/me"
          onClick={(event) => {
            if (!plain(event)) return
            event.preventDefault()
            onMe()
          }}
          className={`${link} ${tone(page === 'me')}`}
        >
          <span className="min-w-0 truncate">{me?.name || '내 정보'}</span>
        </a>
      </div>

      {deleting && <DeleteDialog chat={deleting} working={working} onCancel={cancelDelete} onConfirm={() => void remove(deleting)} />}
    </aside>
  )
}
