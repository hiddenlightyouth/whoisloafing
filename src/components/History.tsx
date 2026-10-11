import { useCallback, useEffect, useState } from 'react'
import { fetchMyChats, type ChatSummary } from '../lib/auth'
import { formatWhen } from '../lib/format'

interface Props {
  onOpenChat: (id: string) => void
  onHome: () => void
}

function Avatar({ owner }: { owner: string }) {
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

function ChatRow({ chat, onOpen }: { chat: ChatSummary; onOpen: () => void }) {
  const [owner, repo] = chat.repoName.includes('/') ? chat.repoName.split('/') : ['', chat.repoName]
  const preview = chat.preview
    ? `${chat.lastSender === 'user' ? '나: ' : ''}${chat.preview}`
    : '아직 주고받은 말풍선이 없어요.'

  return (
    <li>
      <a
        href={`/c/${chat.id}`}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
          event.preventDefault()
          onOpen()
        }}
        className="-mx-3 flex items-center gap-3.5 rounded-2xl px-3 py-3.5 transition-colors hover:bg-gray-50"
      >
        <Avatar owner={owner} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-[15px] text-gray-900">
              {owner && <span className="text-gray-500">{owner}/</span>}
              <span className="font-semibold">{repo}</span>
            </p>
            <span className="shrink-0 text-xs text-gray-400">{formatWhen(chat.updatedAt)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-[13px] text-gray-500">{preview}</p>
            {chat.shared && <span className="shrink-0 text-xs font-medium text-brand">공유함</span>}
          </div>
        </div>
      </a>
    </li>
  )
}

export function History({ onOpenChat, onHome }: Props) {
  const [chats, setChats] = useState<ChatSummary[]>([])
  const [page, setPage] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-5 pt-24 pb-20 sm:pt-28">
        <h1 className="text-[24px] font-semibold leading-snug text-gray-900 sm:text-[30px]">작업 진행 내역</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-gray-500">
          분석했던 레포를 최근에 이어서 본 순서로 모았어요. 누르면 그 채팅으로 돌아가서 이어서 물어볼 수 있어요.
        </p>

        {chats.length > 0 ? (
          <ul className="mt-8">
            {chats.map((chat) => (
              <ChatRow key={chat.id} chat={chat} onOpen={() => onOpenChat(chat.id)} />
            ))}
          </ul>
        ) : loading ? (
          <p className="mt-16 text-center text-[14px] text-gray-400">불러오고 있어요.</p>
        ) : error ? (
          <div className="mt-16 text-center">
            <p className="text-[14px] text-gray-500">{error}</p>
            <button
              type="button"
              onClick={() => void load(0)}
              className="mt-4 h-10 rounded-full bg-gray-100 px-5 text-[14px] font-medium text-gray-700 transition-colors hover:text-brand"
            >
              다시 불러오기
            </button>
          </div>
        ) : (
          <div className="mt-16 text-center">
            <p className="text-[15px] text-gray-600">아직 분석한 레포가 없어요.</p>
            <p className="mt-1.5 text-[13px] text-gray-400">로그인한 채로 분석하면 여기에 모여요.</p>
            <button
              type="button"
              onClick={onHome}
              className="mt-5 h-10 rounded-full bg-brand px-5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              레포 분석하러 가기
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
              {loading ? '불러오고 있어요' : '더 보기'}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
