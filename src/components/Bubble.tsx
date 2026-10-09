import type { ChatMessage } from '../hooks/useAnalysis'
import { RankingCarousel } from './RankingCarousel'
import { SummaryChart } from './SummaryChart'

interface Props {
  message: ChatMessage
  busy: boolean
  /** 가장 최근 말풍선인지 여부. 지난 질문의 버튼은 다시 누를 수 없게 해요. */
  isLast: boolean
  onLogin: (repoUrl?: string) => void
  onChoose: (repoUrl: string, excludeGenerated: boolean) => void
}

const actionButton =
  'mt-3 inline-flex h-9 items-center rounded-lg bg-brand px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:bg-gray-200 disabled:text-gray-400'

const quietButton =
  'mt-3 inline-flex h-9 items-center rounded-lg bg-white px-3.5 text-[13px] font-semibold text-gray-700 transition-colors hover:text-brand disabled:text-gray-400'

export function Bubble({ message, busy, isLast, onLogin, onChoose }: Props) {
  if (message.from === 'user') {
    return (
      <div className="flex animate-rise justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-[15px] leading-relaxed text-white">
          {message.text}
        </p>
      </div>
    )
  }

  const { event, repoUrl } = message
  const wide = event.type === 'ranking' || event.type === 'summary' || event.type === 'list'

  return (
    <div className="flex animate-rise justify-start">
      <div
        className={`rounded-2xl rounded-bl-md bg-gray-100 px-4 py-2.5 text-[15px] leading-relaxed text-gray-900 ${
          wide ? 'w-full pb-4' : 'max-w-[85%]'
        }`}
      >
        <p className="whitespace-pre-line">{event.text}</p>

        {event.type === 'ranking' && <RankingCarousel contributors={event.contributors} />}

        {event.type === 'list' && (
          <ul className="mt-3 mb-1.5 divide-y divide-gray-100 rounded-xl bg-white px-4">
            {event.items.map((item, index) => (
              <li key={`${index}:${item}`} className="flex gap-3 py-2.5 text-[14px] leading-snug">
                <span className="w-4 shrink-0 text-xs leading-5 font-semibold text-brand tabular-nums">{index + 1}</span>
                <span className="min-w-0">{item}</span>
              </li>
            ))}
          </ul>
        )}

        {event.type === 'summary' && (
          <SummaryChart contributors={event.contributors} othersCount={event.othersCount} />
        )}

        {event.type === 'ask' && repoUrl && (
          <div className="mb-1.5 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !isLast}
              onClick={() => onChoose(repoUrl, true)}
              className={actionButton}
            >
              빼고 계산하기
            </button>
            <button
              type="button"
              disabled={busy || !isLast}
              onClick={() => onChoose(repoUrl, false)}
              className={quietButton}
            >
              전부 포함하기
            </button>
          </div>
        )}

        {event.type === 'error' && event.action === 'login' && (
          <div>
            <button type="button" onClick={() => onLogin(repoUrl)} className={`${actionButton} mb-1.5`}>
              GitHub로 로그인
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
