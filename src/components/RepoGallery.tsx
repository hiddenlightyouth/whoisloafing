import { useEffect, useState } from 'react'
import { fetchMyChats } from '../lib/auth'
import { formatWhen } from '../lib/format'
import { canvas, moreButton, pageFrame, PageHeader, PlusIcon } from './AppPage'
import { toolButton } from './DeepParts'
import { primaryButton } from './Dialog'
import { Avatar } from './History'
import { messages, useMessages } from '../lib/i18n'

const TEXT = messages({
  ko: {
    newAnalysis: '새 분석',
    loading: '불러오고 있어요.',
    none: '아직 분석한 레포가 없어요.',
    hint: '새 분석으로 레포를 먼저 분석하면 여기에서 고를 수 있어요.',
    start: '새 분석 시작하기',
    working: '처리 중',
    more: '더 보기',
  },
  en: {
    newAnalysis: 'New analysis',
    loading: 'Loading.',
    none: "You haven't analyzed any repos yet.",
    hint: 'Analyze a repo with New analysis first, and you can pick it here.',
    start: 'Start a new analysis',
    working: 'Working',
    more: 'Show more',
  },
})

/** 갤러리에 보여줄 레포 하나. 같은 레포를 여러 번 분석했으면 가장 최근 것 하나만 남겨요. */
interface RepoCard {
  repo: string
  updatedAt: string
}

/** 링크를 다시 적지 않고, 채팅으로 분석해 둔 레포 중에서 골라요. */
export function RepoGallery({ title, onOpen, onNew, onBack }: {
  title: string
  onOpen: (repo: string) => void
  onNew: () => void
  /** 넘기면 제목 왼쪽에 뒤로 가기 버튼을 둬요. 이력서 만들기처럼 갤러리가 첫 화면이 아닐 때 써요. */
  onBack?: () => void
}) {
  const L = useMessages(TEXT)
  const [cards, setCards] = useState<RepoCard[] | null>(null)
  const [nextPage, setNextPage] = useState<number | null>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load(page: number) {
    setLoading(true)
    const result = await fetchMyChats(page)
    setLoading(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setError('')
    setCards((prev) => {
      const seen = new Set((prev ?? []).map((card) => card.repo))
      const added = result.data.items
        .filter((chat) => chat.repoName.includes('/'))
        .map((chat) => ({ repo: chat.repoName, updatedAt: chat.updatedAt }))
        .filter((card) => !seen.has(card.repo) && seen.add(card.repo))
      return [...(prev ?? []), ...added]
    })
    setNextPage(result.data.hasNext ? page + 1 : null)
  }

  useEffect(() => {
    void load(0)
  }, [])

  return (
    <main className={pageFrame}>
      <PageHeader
        title={title}
        onBack={onBack}
        actions={
          <button type="button" onClick={onNew} className={toolButton}>
            <PlusIcon />
            {L.newAnalysis}
          </button>
        }
      />

      <div className={`${canvas} overflow-y-auto px-6 pt-6 pb-10 md:px-10`}>
      {cards === null ? (
        error ? (
          <p className="mt-10 text-center text-[14px] text-gray-500">{error}</p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3" aria-busy="true">
            <li className="sr-only">{L.loading}</li>
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <li key={item} aria-hidden className="h-[132px] rounded-2xl border border-gray-200 bg-white motion-safe:animate-pulse" />
            ))}
          </ul>
        )
      ) : cards.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          <p className="text-[14px] leading-relaxed text-gray-600">
            {L.none}
            <br />
            {L.hint}
          </p>
          <button type="button" onClick={onNew} className={primaryButton}>
            {L.start}
          </button>
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {cards.map((card, order) => {
              const [owner, name] = card.repo.split('/')
              return (
                // 카드는 앞에서부터 조금씩 늦게 떠올라요.
                <li key={card.repo} className="animate-rise" style={{ animationDelay: `${Math.min(order % 20, 14) * 28}ms` }}>
                  <button
                    type="button"
                    onClick={() => onOpen(card.repo)}
                    className="flex h-[132px] w-full flex-col justify-between rounded-2xl border border-gray-200 bg-white p-4 text-left transition-colors hover:border-brand"
                  >
                    <Avatar owner={owner} />
                    <span className="min-w-0">
                      <span className="block truncate text-[14.5px] font-semibold text-gray-900">{name}</span>
                      <span className="mt-0.5 flex items-center justify-between gap-2 text-[12px] text-gray-400">
                        <span className="min-w-0 truncate">{owner}</span>
                        <span className="shrink-0">{formatWhen(card.updatedAt)}</span>
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {nextPage !== null && (
            <div className="mt-8 text-center">
              <button type="button" disabled={loading} onClick={() => void load(nextPage)} className={moreButton}>
                {loading ? L.working : L.more}
              </button>
            </div>
          )}
        </>
      )}
      </div>
    </main>
  )
}
