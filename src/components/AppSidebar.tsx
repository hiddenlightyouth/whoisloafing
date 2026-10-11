import { useEffect, useState, type MouseEvent } from 'react'
import { fetchMyChats, useAuth, type ChatSummary } from '../lib/auth'
import { formatWhen } from '../lib/format'
import type { AccountPage } from './Account'
import { Bone } from './Skeleton'

interface Props {
  /** 지금 열려 있는 채팅. 목록에서 강조해요. */
  activeChatId: string | null
  /** 지금 보고 있는 화면. 아래쪽 링크를 강조해요. */
  page: 'articles' | AccountPage | null
  /** 값이 바뀌면 목록을 다시 받아요. */
  refreshKey: string
  onNew: () => void
  onOpenChat: (id: string) => void
  onArticles: () => void
  onAccount: (page: AccountPage) => void
}

const SKELETON_ROWS = ['w-4/5', 'w-3/5', 'w-2/3', 'w-1/2']

const link = 'flex h-9 w-full items-center rounded-xl px-3 text-left text-[13px] font-medium transition-colors'
const tone = (active: boolean) => (active ? 'bg-gray-200/70 text-gray-900' : 'text-gray-600 hover:bg-gray-200/50 hover:text-gray-900')

const plain = (event: MouseEvent) => !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)

/** 앱 화면 왼쪽에 늘 떠 있는 사이드바예요. 새 분석, 내 작업 목록, 아티클과 내 정보로 가는 링크가 있어요. */
export function AppSidebar({ activeChatId, page, refreshKey, onNew, onOpenChat, onArticles, onAccount }: Props) {
  const { me } = useAuth()
  const [chats, setChats] = useState<ChatSummary[] | null>(null)
  const [hasNext, setHasNext] = useState(false)
  const [error, setError] = useState('')

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
      setHasNext(result.data.hasNext)
    })
    return () => {
      stale = true
    }
  }, [refreshKey])

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-gray-200 bg-gray-50">
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
          새 분석
        </button>
      </div>

      <div className="mt-5 flex items-center justify-between px-6">
        <h2 className="text-xs font-medium text-gray-400">내 작업</h2>
        <a
          href="/history"
          onClick={(event) => {
            if (!plain(event)) return
            event.preventDefault()
            onAccount('history')
          }}
          className={`text-xs font-medium transition-colors ${page === 'history' ? 'text-brand' : 'text-gray-400 hover:text-gray-700'}`}
        >
          관리
        </a>
      </div>

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
          <ul>
            {chats.map((chat) => {
              const [owner, repo] = chat.repoName.includes('/') ? chat.repoName.split('/') : ['', chat.repoName]
              return (
                <li key={chat.id}>
                  <a
                    href={`/c/${chat.id}`}
                    aria-current={chat.id === activeChatId ? 'page' : undefined}
                    onClick={(event) => {
                      if (!plain(event)) return
                      event.preventDefault()
                      onOpenChat(chat.id)
                    }}
                    className={`block rounded-xl px-3 py-2 transition-colors ${tone(chat.id === activeChatId)}`}
                  >
                    <p className="truncate text-[13px] font-semibold text-gray-900">{repo}</p>
                    <p className="mt-0.5 flex items-center justify-between gap-2 text-xs text-gray-400">
                      <span className="min-w-0 truncate">{owner}</span>
                      <span className="shrink-0">{chat.shared ? '공유함' : formatWhen(chat.updatedAt)}</span>
                    </p>
                  </a>
                </li>
              )
            })}
            {hasNext && (
              <li>
                <button type="button" onClick={() => onAccount('history')} className={`${link} ${tone(false)}`}>
                  모두 보기
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
            onAccount('me')
          }}
          className={`${link} ${tone(page === 'me')}`}
        >
          <span className="min-w-0 truncate">{me?.name || '내 정보'}</span>
        </a>
      </div>
    </aside>
  )
}
