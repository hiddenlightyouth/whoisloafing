import { useCallback, useEffect, useRef, useState } from 'react'
import { track } from '../lib/analytics'
import { canPinChats, deleteChat, pinChat, reorderPinned, unshareChat } from '../lib/api'
import { fetchMyChats, type ChatSummary } from '../lib/auth'
import { formatWhen } from '../lib/format'
import { showToast } from '../lib/toast'
import { Bone } from './Skeleton'
import { messages, pick, useMessages } from '../lib/i18n'

export const CHAT_LIST_TEXT = messages({
  ko: {
    deleteTitle: '이 채팅을 지울까요?',
    deleteBody: (repo: string, shared: boolean) => `${repo} 분석 채팅을 지워요. ${shared ? '공유한 링크도 더 이상 열리지 않고, ' : ''}지운 채팅은 되돌릴 수 없어요.`,
    cancel: '취소',
    working: '처리 중',
    delete: '지우기',
    me: '나: ',
    empty: '아직 주고받은 말풍선이 없어요.',
    pinned: '고정한 채팅',
    shared: '공유함',
    manage: (repo: string) => `${repo} 채팅 관리`,
    unpin: '고정 해제',
    pin: '상단에 고정',
    copied: '링크를 복사했어요.',
    copyFailed: '링크를 복사하지 못했어요.',
    copyLink: '링크 복사',
    unshare: '공유 취소',
    unshareFailed: '공유를 취소하지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
    unshared: '공유를 취소했어요. 이제 링크로 열 수 없어요.',
    pinFailed: '고정하지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
    unpinFailed: '고정을 풀지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
    pinDone: '맨 위에 고정했어요.',
    unpinDone: '고정을 풀었어요.',
    deleteFailed: '채팅을 지우지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
    deleted: '채팅을 지웠어요.',
    title: '내 작업',
    loading: '불러오고 있어요.',
    reload: '다시 불러오기',
    none: '아직 분석한 레포가 없어요.',
    start: '첫 분석을 시작해볼까요?',
    analyze: '분석하기',
    more: '더 보기',
  },
  en: {
    deleteTitle: 'Delete this chat?',
    deleteBody: (repo: string, shared: boolean) => `This deletes the analysis chat for ${repo}. ${shared ? 'The shared link will stop working too, and deleted' : 'Deleted'} chats can't be recovered.`,
    cancel: 'Cancel',
    working: 'Working',
    delete: 'Delete',
    me: 'You: ',
    empty: 'No messages yet.',
    pinned: 'Pinned chat',
    shared: 'Shared',
    manage: (repo: string) => `Manage ${repo} chat`,
    unpin: 'Unpin',
    pin: 'Pin to top',
    copied: 'Link copied.',
    copyFailed: "Couldn't copy the link.",
    copyLink: 'Copy link',
    unshare: 'Stop sharing',
    unshareFailed: "Couldn't stop sharing. Please try again in a moment.",
    unshared: 'Stopped sharing. The link no longer opens this chat.',
    pinFailed: "Couldn't pin. Please try again in a moment.",
    unpinFailed: "Couldn't unpin. Please try again in a moment.",
    pinDone: 'Pinned to the top.',
    unpinDone: 'Unpinned.',
    deleteFailed: "Couldn't delete the chat. Please try again in a moment.",
    deleted: 'Chat deleted.',
    title: 'My chats',
    loading: 'Loading.',
    reload: 'Reload',
    none: "You haven't analyzed any repos yet.",
    start: 'Ready to start your first analysis?',
    analyze: 'Analyze a repo',
    more: 'Show more',
  },
})

interface Props {
  onOpenChat: (id: string) => void
  onHome: () => void
}

const SKELETON_ROWS = ['w-4/5', 'w-3/5', 'w-2/3', 'w-1/2', 'w-3/4', 'w-3/5']

/** 레포 소유자의 GitHub 프로필 사진이에요. 받지 못하면 이름의 첫 글자를 보여줘요. 심층 분석의 갤러리에서도 써요. */
export function Avatar({ owner }: { owner: string }) {
  const [failed, setFailed] = useState(false)

  if (failed || !owner) {
    return (
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[16px] font-semibold text-brand-hover">
        {(owner[0] ?? '?').toUpperCase()}
      </span>
    )
  }

  return (
    <img
      src={`https://github.com/${encodeURIComponent(owner)}.png?size=96`}
      alt=""
      width={48}
      height={48}
      loading="lazy"
      onError={() => setFailed(true)}
      className="size-12 shrink-0 rounded-full border border-gray-100 bg-gray-50 object-cover"
    />
  )
}

export async function copyChatLink(id: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/c/${id}`)
    return true
  } catch {
    return false
  }
}

/** 채팅을 지우기 전에 한 번 더 묻는 창이에요. */
export function DeleteDialog({ chat, working, onCancel, onConfirm }: { chat: ChatSummary; working: boolean; onCancel: () => void; onConfirm: () => void }) {
  const text = useMessages(CHAT_LIST_TEXT)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 animate-fade z-30 flex items-center justify-center bg-gray-900/25 px-5 backdrop-blur-[2px]"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        className="w-full max-w-xs animate-pop rounded-2xl border border-gray-200 bg-white p-5"
      >
        <h2 id="delete-dialog-title" className="text-[15px] font-semibold text-gray-900">
          {text.deleteTitle}
        </h2>
        <p className="mt-1.5 break-keep text-[13px] leading-relaxed text-gray-500 [overflow-wrap:anywhere]">
          {text.deleteBody(chat.repoName, chat.shared)}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-full px-3.5 text-[13px] font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            {text.cancel}
          </button>
          <button
            type="button"
            autoFocus
            disabled={working}
            onClick={onConfirm}
            className="h-9 rounded-full bg-red-500 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400"
          >
            {working ? text.working : text.delete}
          </button>
        </div>
      </div>
    </div>
  )
}

interface RowProps {
  chat: ChatSummary
  menuOpen: boolean
  working: boolean
  onOpen: () => void
  onToggleMenu: () => void
  onCloseMenu: () => void
  onUnshare: () => void
  /** 맨 위에 고정하거나 고정을 풀어요. 서버가 지원하지 않으면 넘기지 않아요. */
  onPin?: () => void
  onDelete: () => void
}

function ChatRow({ chat, menuOpen, working, onOpen, onToggleMenu, onCloseMenu, onUnshare, onPin, onDelete }: RowProps) {
  const [owner, repo] = chat.repoName.includes('/') ? chat.repoName.split('/') : ['', chat.repoName]
  const text = useMessages(CHAT_LIST_TEXT)
  const preview = chat.preview
    ? `${chat.lastSender === 'user' ? text.me : ''}${chat.preview}`
    : text.empty
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

  const item = 'block w-full rounded-xl px-3 py-2 text-left text-[13px] font-medium transition-colors hover:bg-gray-50 disabled:text-gray-400'

  return (
    <li className="-mx-3 flex items-center rounded-2xl transition-colors hover:bg-gray-50">
      <a
        href={`/c/${chat.id}`}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
          event.preventDefault()
          onOpen()
        }}
        className="flex min-w-0 flex-1 items-center gap-3.5 py-3.5 pl-3"
      >
        <Avatar owner={owner} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="flex min-w-0 items-center gap-1.5 text-[15px] text-gray-900">
              <span className="min-w-0 truncate">
                {owner && <span className="text-gray-500">{owner}/</span>}
                <span className="font-semibold">{repo}</span>
              </span>
              {chat.pinned && (
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 shrink-0 text-gray-400" role="img" aria-label={text.pinned}>
                <path d="M9.5 2.5l4 4-2 .5-2.2 2.2.2 2.8L4 6.5l2.8.2L9 4.5zM6.7 9.3L3 13" />
              </svg>
              )}
            </p>
            <span className="shrink-0 text-xs text-gray-400">{formatWhen(chat.updatedAt)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-[13px] text-gray-500">{preview}</p>
            {chat.shared && <span className="shrink-0 text-xs font-medium text-brand">{text.shared}</span>}
          </div>
        </div>
      </a>

      <div ref={menuRef} className="relative shrink-0 py-3.5 pr-1.5 pl-1">
        <button
          type="button"
          aria-label={text.manage(chat.repoName)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={onToggleMenu}
          className="flex size-8 items-center justify-center gap-[3px] rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <span className="size-[3px] rounded-full bg-current" />
          <span className="size-[3px] rounded-full bg-current" />
          <span className="size-[3px] rounded-full bg-current" />
        </button>

        {menuOpen && (
          <div role="menu" className="absolute top-full right-1 z-10 -mt-2 w-36 origin-top-right animate-pop rounded-2xl border border-gray-200 bg-white p-1.5">
            {onPin && (
              <button type="button" role="menuitem" disabled={working} onClick={onPin} className={`${item} text-gray-700`}>
                {chat.pinned ? text.unpin : text.pin}
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
                    track('share_link_copy', { success: ok, is_owner: true, from: 'history' })
                    showToast(ok ? pick(CHAT_LIST_TEXT).copied : pick(CHAT_LIST_TEXT).copyFailed)
                  }}
                  className={`${item} text-gray-700`}
                >
                  {text.copyLink}
                </button>
                <button type="button" role="menuitem" disabled={working} onClick={onUnshare} className={`${item} text-gray-700`}>
                  {text.unshare}
                </button>
              </>
            )}
            <button type="button" role="menuitem" disabled={working} onClick={onDelete} className={`${item} text-red-500`}>
              {text.delete}
            </button>
          </div>
        )}
      </div>
    </li>
  )
}

export function History({ onOpenChat, onHome }: Props) {
  const [chats, setChats] = useState<ChatSummary[]>([])
  const text = useMessages(CHAT_LIST_TEXT)
  const [page, setPage] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<ChatSummary | null>(null)
  const [working, setWorking] = useState(false)
  const [canPin, setCanPin] = useState(false)

  useEffect(() => {
    void canPinChats().then(setCanPin)
  }, [])

  const load = useCallback(async (next: number) => {
    setLoading(true)
    const result = await fetchMyChats(next)
    setLoading(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setError('')
    setChats((prev) => (next === 0 ? result.data.items : [...prev, ...result.data.items]))
    setPage(next)
    setHasNext(result.data.hasNext)
  }, [])

  useEffect(() => {
    void load(0)
  }, [load])

  const closeMenu = useCallback(() => setMenuFor(null), [])
  const cancelDelete = useCallback(() => setDeleting(null), [])

  async function unshare(chat: ChatSummary) {
    setMenuFor(null)
    setWorking(true)
    const ok = await unshareChat(chat.id)
    setWorking(false)
    track('chat_unshare', { success: ok })
    if (!ok) {
      showToast(pick(CHAT_LIST_TEXT).unshareFailed)
      return
    }
    setChats((prev) => prev.map((item) => (item.id === chat.id ? { ...item, shared: false } : item)))
    showToast(pick(CHAT_LIST_TEXT).unshared)
  }

  async function pin(chat: ChatSummary) {
    const pinned = !chat.pinned
    setMenuFor(null)
    setWorking(true)
    const ok = await pinChat(chat.id, pinned)
    setWorking(false)
    track('chat_pin', { pinned, success: ok })
    if (!ok) {
      showToast(pinned ? pick(CHAT_LIST_TEXT).pinFailed : pick(CHAT_LIST_TEXT).unpinFailed)
      return
    }
    setChats((prev) => reorderPinned(prev, chat.id, pinned))
    showToast(pinned ? pick(CHAT_LIST_TEXT).pinDone : pick(CHAT_LIST_TEXT).unpinDone)
  }

  async function remove(chat: ChatSummary) {
    setWorking(true)
    const ok = await deleteChat(chat.id)
    setWorking(false)
    track('chat_delete', { success: ok, shared: chat.shared })
    if (!ok) {
      showToast(pick(CHAT_LIST_TEXT).deleteFailed)
      return
    }
    setDeleting(null)
    setChats((prev) => prev.filter((item) => item.id !== chat.id))
    showToast(pick(CHAT_LIST_TEXT).deleted)
  }

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-5 pt-24 pb-20 sm:pt-28">
        <h1 className="text-[24px] font-semibold leading-snug text-gray-900 sm:text-[30px]">{text.title}</h1>

        {chats.length > 0 ? (
          <ul className="mt-8">
            {chats.map((chat) => (
              <ChatRow
                key={chat.id}
                chat={chat}
                menuOpen={menuFor === chat.id}
                working={working}
                onOpen={() => onOpenChat(chat.id)}
                onToggleMenu={() => setMenuFor((open) => (open === chat.id ? null : chat.id))}
                onCloseMenu={closeMenu}
                onUnshare={() => void unshare(chat)}
                onPin={canPin ? () => void pin(chat) : undefined}
                onDelete={() => {
                  setMenuFor(null)
                  setDeleting(chat)
                }}
              />
            ))}
          </ul>
        ) : loading ? (
          <ul className="mt-8" aria-busy="true">
            <li className="sr-only">{text.loading}</li>
            {SKELETON_ROWS.map((width, index) => (
              <li key={index} aria-hidden className="flex items-center gap-3.5 py-3.5">
                <Bone className="size-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <Bone className="h-4 w-2/5" />
                    <Bone className="h-3 w-10" />
                  </div>
                  <Bone className={`mt-2.5 h-3.5 ${width}`} />
                </div>
              </li>
            ))}
          </ul>
        ) : error ? (
          <div className="mt-16 text-center">
            <p className="text-[14px] text-gray-500">{error}</p>
            <button
              type="button"
              onClick={() => void load(0)}
              className="mt-4 h-10 rounded-full bg-gray-100 px-5 text-[14px] font-medium text-gray-700 transition-colors hover:text-brand"
            >
              {text.reload}
            </button>
          </div>
        ) : (
          <div className="mt-16 text-center">
            <p className="text-[15px] text-gray-600">{text.none}</p>
            <p className="mt-1.5 text-[13px] text-gray-400">{text.start}</p>
            <button
              type="button"
              onClick={onHome}
              className="mt-5 h-10 rounded-full bg-brand px-5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              {text.analyze}
            </button>
          </div>
        )}

        {chats.length > 0 && error && <p className="mt-3 text-center text-[13px] text-red-500">{error}</p>}
        {chats.length > 0 && hasNext && (
          <div className="mt-6 text-center">
            <button
              type="button"
              disabled={loading}
              onClick={() => void load(page + 1)}
              className="h-9 rounded-full bg-gray-100 px-4 text-[13px] font-medium text-gray-700 transition-colors hover:text-brand disabled:text-gray-400"
            >
              {loading ? text.working : text.more}
            </button>
          </div>
        )}
      </div>
      {deleting && <DeleteDialog chat={deleting} working={working} onCancel={cancelDelete} onConfirm={() => void remove(deleting)} />}
    </main>
  )
}
