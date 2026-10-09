import type { ChatMessage } from '../hooks/useAnalysis'
import { StatsCard } from './StatsCard'
import { SummaryChart } from './SummaryChart'

interface Props {
  message: ChatMessage
  busy: boolean
  onLogin: (repoUrl?: string) => void
  onRefine: (repoUrl: string) => void
}

const actionButton =
  'mt-3 inline-flex h-9 items-center rounded-lg bg-brand px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:bg-gray-200 disabled:text-gray-400'

export function Bubble({ message, busy, onLogin, onRefine }: Props) {
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
  const wide = event.type === 'stats' || event.type === 'summary'

  return (
    <div className="flex animate-rise justify-start">
      <div
        className={`rounded-2xl rounded-bl-md bg-gray-100 px-4 py-2.5 text-[15px] leading-relaxed text-gray-900 ${
          wide ? 'w-full max-w-md pb-4' : 'max-w-[85%]'
        }`}
      >
        <p>{event.text}</p>

        {event.type === 'stats' && <StatsCard contributor={event.contributor} />}

        {event.type === 'summary' && (
          <>
            <SummaryChart contributors={event.contributors} othersCount={event.othersCount} />
            {event.canRefine && repoUrl && (
              <button type="button" disabled={busy} onClick={() => onRefine(repoUrl)} className={actionButton}>
                lock 파일과 빌드 결과물 빼고 다시 계산하기
              </button>
            )}
          </>
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
