import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { track } from '../lib/analytics'
import { canPinChats, deleteChat, pinChat, reorderPinned, unshareChat } from '../lib/api'
import { fetchMyChats, signOut, useAuth, type ChatSummary, type Me } from '../lib/auth'
import { openBugReport, useFeedback } from '../lib/feedback'
import { formatWhen } from '../lib/format'
import { showToast } from '../lib/toast'
import { copyChatLink, DeleteDialog } from './History'
import { Kbd } from './Shortcuts'
import { Bone } from './Skeleton'

interface Props {
  /** 지금 열려 있는 채팅. 목록에서 강조해요. */
  activeChatId: string | null
  /** 지금 보고 있는 화면. 아래쪽 링크를 강조해요. */
  page: 'deep' | 'explore' | 'articles' | 'me' | 'admin' | null
  /** 값이 바뀌면 목록을 다시 받아요. */
  refreshKey: string
  onNew: () => void
  /** 심층 분석 화면을 열어요. 서버에 심층 분석 API가 없으면 넘기지 않고, 그때는 버튼을 숨겨요. */
  onDeep?: () => void
  /** 탐색 화면을 열어요. 서버에 탐색 API가 없으면 넘기지 않고, 그때는 버튼을 숨겨요. */
  onExplore?: () => void
  /** 내 작업의 채팅에서 그 레포의 심층 분석으로 바로 가요. 서버에 심층 분석 API가 없으면 넘기지 않아요. */
  onDeepRepo?: (repo: string) => void
  onOpenChat: (id: string) => void
  /** 목록에서 공유를 취소하거나 지웠을 때 불러요. 열려 있는 채팅이면 화면도 맞춰요. */
  onChatChanged: (id: string, change: 'unshared' | 'deleted') => void
  onArticles: () => void
  onMe: () => void
  /** 앱의 설정 창을 띄워요. */
  onSettings: () => void
  /** 설정 창이 떠 있는지. 떠 있는 동안 설정 버튼을 켜진 것으로 보여줘요. */
  settingsOpen: boolean
  /** 관리자 화면을 열어요. 관리자 계정일 때만 넘기고, 아니면 메뉴에 보여주지 않아요. */
  onAdmin?: () => void
}

const SKELETON_ROWS = ['w-4/5', 'w-3/5', 'w-2/3', 'w-1/2']

const link = 'flex h-9 w-full items-center rounded-xl px-3 text-left text-[13px] font-medium transition-colors'
const tone = (active: boolean) => (active ? 'bg-gray-200/70 text-gray-900' : 'text-gray-600 hover:bg-gray-200/50 hover:text-gray-900')
const menuItem = 'block w-full rounded-xl px-3 py-2 text-left text-[13px] font-medium transition-colors hover:bg-gray-50 disabled:text-gray-400'

const plain = (event: MouseEvent) => !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)

interface RowProps {
  chat: ChatSummary
  active: boolean
  menuOpen: boolean
  working: boolean
  onOpen: () => void
  onToggleMenu: () => void
  onCloseMenu: () => void
  onUnshare: () => void
  /** 맨 위에 고정하거나 고정을 풀어요. 서버가 지원하지 않으면 넘기지 않아요. */
  onPin?: () => void
  /** 이 채팅의 레포를 심층 분석으로 열어요. */
  onDeep?: () => void
  onDelete: () => void
}

function ChatRow({ chat, active, menuOpen, working, onOpen, onToggleMenu, onCloseMenu, onUnshare, onPin, onDeep, onDelete }: RowProps) {
  const [owner, repo] = chat.repoName.includes('/') ? chat.repoName.split('/') : ['', chat.repoName]
  const menuRef = useRef<HTMLLIElement>(null)

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
    <li ref={menuRef} className={`group relative flex items-center rounded-xl transition-colors ${tone(active || menuOpen)}`}>
      <a
        href={`/c/${chat.id}`}
        aria-current={active ? 'page' : undefined}
        onClick={(event) => {
          if (!plain(event)) return
          event.preventDefault()
          onOpen()
        }}
        className="min-w-0 flex-1 px-3 py-2"
      >
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-900">
          {chat.shared && (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-3.5 shrink-0 text-brand" role="img" aria-label="공유한 채팅">
              <path d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2.2-2.2a2.6 2.6 0 0 0-3.7-3.7l-.8.8M9.2 6.8a2.6 2.6 0 0 0-3.7 0L3.3 9a2.6 2.6 0 0 0 3.7 3.7l.8-.8" strokeLinecap="round" />
            </svg>
          )}
          <span className="min-w-0 truncate">{repo}</span>
          {chat.pinned && (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="size-3 shrink-0 text-gray-400" role="img" aria-label="고정한 채팅">
                <path d="M9.5 2.5l4 4-2 .5-2.2 2.2.2 2.8L4 6.5l2.8.2L9 4.5zM6.7 9.3L3 13" />
              </svg>
          )}
        </p>
        <p className="mt-0.5 flex items-center justify-between gap-2 text-xs text-gray-400">
          <span className="min-w-0 truncate">{owner}</span>
          <span className="shrink-0">{formatWhen(chat.updatedAt)}</span>
        </p>
      </a>

      {/* 평소에는 자리를 차지하지 않다가, 마우스를 올리면 시간 옆으로 부드럽게 밀고 들어와요. */}
      <div
        className={`flex shrink-0 items-center overflow-hidden transition-[width,opacity] duration-200 ease-out group-hover:opacity-100 group-focus-within:opacity-100 ${
          onDeep ? 'group-hover:w-[60px] group-focus-within:w-[60px]' : 'group-hover:w-8 group-focus-within:w-8'
        } ${menuOpen ? `${onDeep ? 'w-[60px]' : 'w-8'} opacity-100` : 'w-0 opacity-0'}`}
      >
        {onDeep && (
          <button
            type="button"
            aria-label={`${chat.repoName} 심층 분석`}
            title="심층 분석"
            onClick={onDeep}
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
              <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
              <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
              <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
              <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
            </svg>
          </button>
        )}
        <button
          type="button"
          aria-label={`${chat.repoName} 채팅 관리`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={onToggleMenu}
          className="flex size-7 shrink-0 items-center justify-center gap-[3px] rounded-full text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
        >
          <span className="size-[3px] rounded-full bg-current" />
          <span className="size-[3px] rounded-full bg-current" />
          <span className="size-[3px] rounded-full bg-current" />
        </button>
      </div>

      {menuOpen && (
        <div role="menu" className="absolute top-full right-1 z-10 -mt-1 w-36 animate-rise rounded-2xl border border-gray-200 bg-white p-1.5">
          {onPin && (
            <button type="button" role="menuitem" disabled={working} onClick={onPin} className={`${menuItem} text-gray-700`}>
              {chat.pinned ? '고정 해제' : '상단에 고정'}
            </button>
          )}
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
    </li>
  )
}

/** 앱 화면 왼쪽의 사이드바예요. 새 분석, 내 작업 목록과 관리, 아티클과 내 정보로 가는 링크가 있어요. */
export function AppSidebar({ activeChatId, page, refreshKey, onNew, onDeep, onExplore, onOpenChat, onDeepRepo, onChatChanged, onArticles, onMe, onSettings, settingsOpen, onAdmin }: Props) {
  const { me } = useAuth()
  const [chats, setChats] = useState<ChatSummary[] | null>(null)
  const [nextPage, setNextPage] = useState<number | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<ChatSummary | null>(null)
  const [working, setWorking] = useState(false)
  const [canPin, setCanPin] = useState(false)

  useEffect(() => {
    void canPinChats().then(setCanPin)
  }, [])

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

  async function pin(chat: ChatSummary) {
    const pinned = !chat.pinned
    setMenuFor(null)
    setWorking(true)
    const ok = await pinChat(chat.id, pinned)
    setWorking(false)
    track('chat_pin', { pinned, success: ok, from: 'sidebar' })
    if (!ok) {
      showToast(pinned ? '고정하지 못했어요. 잠시 뒤에 다시 시도해 주세요.' : '고정을 풀지 못했어요. 잠시 뒤에 다시 시도해 주세요.')
      return
    }
    setChats((prev) => (prev ? reorderPinned(prev, chat.id, pinned) : prev))
    showToast(pinned ? '맨 위에 고정했어요.' : '고정을 풀었어요.')
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
    <aside className="relative z-30 flex w-64 shrink-0 flex-col border-r border-gray-200 bg-gray-50">
      <div data-app-drag className="h-11 shrink-0" />

      <div className="px-3">
        <button
          type="button"
          onClick={onNew}
          className="flex h-10 w-full items-center gap-2 rounded-xl bg-white px-3 text-[13px] font-semibold text-gray-900 ring-1 ring-gray-200 transition-colors hover:text-brand"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="size-4" aria-hidden="true">
            <path d="M8 3v10M3 8h10" />
          </svg>
          <span className="flex-1 text-left">새 분석</span>
          <Kbd>N</Kbd>
        </button>
        {onExplore && (
          <a
            href="/explore"
            aria-current={page === 'explore' ? 'page' : undefined}
            onClick={(event) => {
              if (!plain(event)) return
              event.preventDefault()
              track('explore_open', { from: 'sidebar' })
              onExplore()
            }}
            className={`${link} mt-1.5 gap-2 ${tone(page === 'explore')}`}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
              <circle cx="8" cy="8" r="5.5" />
              <path d="m10.2 5.8-1.3 3.1-3.1 1.3 1.3-3.1z" />
            </svg>
            <span className="flex-1">탐색</span>
            <Kbd>T</Kbd>
          </a>
        )}
        {onDeep && (
          <a
            href="/deep"
            aria-current={page === 'deep' ? 'page' : undefined}
            onClick={(event) => {
              if (!plain(event)) return
              event.preventDefault()
              onDeep()
            }}
            className={`${link} mt-1.5 gap-2 ${tone(page === 'deep')}`}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" className="size-4" aria-hidden="true">
              <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
              <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
              <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
              <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
            </svg>
            <span className="flex-1">심층 분석</span>
            <Kbd>D</Kbd>
          </a>
        )}
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
                onPin={canPin ? () => void pin(chat) : undefined}
                onDeep={onDeepRepo && chat.repoName.includes('/') ? () => onDeepRepo(chat.repoName) : undefined}
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

      <AccountMenu me={me} page={page} onArticles={onArticles} onMe={onMe} onSettings={onSettings} settingsOpen={settingsOpen} onAdmin={onAdmin} />

      {deleting && <DeleteDialog chat={deleting} working={working} onCancel={cancelDelete} onConfirm={() => void remove(deleting)} />}
    </aside>
  )
}

const menuRow = 'flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13.5px] text-gray-800 transition-colors hover:bg-gray-100'
const menuIcon = 'size-4 shrink-0 text-gray-500'

/**
 * 사이드바 맨 아래의 계정 버튼이에요. 누르면 위로 메뉴가 펼쳐져서 내 정보, 아티클, 관리자 화면으로 가거나 로그아웃해요. 오른쪽에는 설정과 버그 신고 버튼이 있어요.
 * 바깥을 누르거나 Esc를 누르면 닫혀요.
 */
function AccountMenu({ me, page, onArticles, onMe, onSettings, settingsOpen, onAdmin }: { me: Me | null; page: Props['page']; onArticles: () => void; onMe: () => void; onSettings: () => void; settingsOpen: boolean; onAdmin?: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { ready: canReport } = useFeedback()
  const name = me?.name || '내 정보'

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const go = (action: () => void) => () => {
    setOpen(false)
    action()
  }

  return (
    <div ref={ref} className="relative flex shrink-0 items-center gap-1 border-t border-gray-200 p-2">
      {open && (
        <div role="menu" className="absolute bottom-full left-2 mb-1 w-[272px] animate-rise rounded-2xl border border-gray-200 bg-white p-1.5">
          {me?.email && <p className="truncate px-2.5 pt-1.5 pb-2 text-[12.5px] text-gray-500">{me.email}</p>}

          <button type="button" role="menuitem" onClick={go(onMe)} className={menuRow}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className={menuIcon} aria-hidden="true">
              <circle cx="8" cy="5.5" r="2.5" />
              <path d="M3 13.5c.6-2.2 2.6-3.5 5-3.5s4.4 1.3 5 3.5" strokeLinecap="round" />
            </svg>
            내 정보
          </button>
          <button type="button" role="menuitem" onClick={go(onArticles)} className={menuRow}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" className={menuIcon} aria-hidden="true">
              <path d="M3.5 2.5h6l3 3v8h-9z" />
              <path d="M5.5 8h5M5.5 10.5h5" strokeLinecap="round" />
            </svg>
            아티클
          </button>
          {onAdmin && (
            <button type="button" role="menuitem" onClick={go(onAdmin)} className={menuRow}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" className={menuIcon} aria-hidden="true">
                <path d="M8 2l4.5 1.7v3.6c0 2.9-1.8 5.3-4.5 6.4-2.7-1.1-4.5-3.5-4.5-6.4V3.7z" />
              </svg>
              관리자
            </button>
          )}

          <div className="my-1.5 border-t border-gray-100" />

          <button
            type="button"
            role="menuitem"
            onClick={go(() => {
              track('auth_logout', { from: 'menu' })
              void signOut()
            })}
            className={menuRow}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={menuIcon} aria-hidden="true">
              <path d="M6.5 2.5h-2a1.5 1.5 0 0 0-1.5 1.5v8a1.5 1.5 0 0 0 1.5 1.5h2M10 5l3 3-3 3M13 8H6.5" />
            </svg>
            로그아웃
          </button>
        </div>
      )}

      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          if (!open) track('app_menu_open')
          setOpen((value) => !value)
        }}
        className={`flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 text-left transition-colors ${tone(open || page === 'me' || page === 'articles' || page === 'admin')}`}
      >
        {/* 프로필 사진 대신 이름의 첫 글자를 동그라미에 넣어요. */}
        <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-semibold text-brand-hover">
          {[...(me?.name?.trim() || '?')][0].toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold text-gray-900">{name}</span>
        </span>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4 shrink-0 text-gray-400" aria-hidden="true">
          <path d="M5 6.5L8 3.5l3 3M5 9.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {/* 설정 창을 띄우는 버튼이에요. 버그 신고 버튼 왼쪽에 둬요. */}
      <button
        type="button"
        aria-label="설정"
        title="설정"
        aria-haspopup="dialog"
        aria-expanded={settingsOpen}
        onClick={onSettings}
        className={`flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-gray-200/50 hover:text-gray-700 ${settingsOpen ? 'bg-gray-200/70 text-gray-900' : 'text-gray-400'}`}
      >
        {/* 톱니바퀴 그림이에요. */}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
      {/* 사이드바 오른쪽 아래의 버그 신고 버튼이에요. 서버가 신고를 받을 때만 보여줘요. */}
      {canReport && (
        <button
          type="button"
          aria-label="버그 신고"
          title="버그 신고"
          onClick={openBugReport}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-200/50 hover:text-gray-700"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
            <path d="M5.5 5.5a2.5 2.5 0 0 1 5 0M5 6.5h6a1 1 0 0 1 1 1v2a4 4 0 0 1-8 0v-2a1 1 0 0 1 1-1zM8 8v5.5M4 9H2M14 9h-2M4.5 12L3 13.5M11.5 12l1.5 1.5M4.3 6.8L3 5.5M11.7 6.8L13 5.5" />
          </svg>
        </button>
      )}
    </div>
  )
}
