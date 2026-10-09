import { useState } from 'react'
import type { AnalyzeRequest, FollowupQuestion } from '../../shared/types'
import type { ChatMessage } from '../hooks/useAnalysis'
import { repoLabel, track } from '../lib/analytics'
import { Charts, Facts } from './Charts'
import { Followup } from './Followup'
import { PeoplePicker } from './PeoplePicker'
import { RankingCarousel } from './RankingCarousel'
import { RichText } from './RichText'
import { SummaryChart } from './SummaryChart'

interface Props {
  message: ChatMessage
  busy: boolean
  /** 가장 최근 말풍선인지 여부. 지난 질문의 버튼은 다시 누를 수 없게 해요. */
  isLast: boolean
  /** userText가 있으면 사용자 말풍선을 올리고 요청을 보내요. 없으면 조용히 다시 시도해요. */
  onSend: (request: AnalyzeRequest, userText?: string) => void
}

const actionButton =
  'mt-3 inline-flex h-9 items-center rounded-lg bg-brand px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:bg-gray-200 disabled:text-gray-400'

const quietButton =
  'mt-3 inline-flex h-9 items-center rounded-lg bg-white px-3.5 text-[13px] font-semibold text-gray-700 transition-colors hover:text-brand disabled:text-gray-400'

const WIDE_TYPES = new Set(['ranking', 'summary', 'list', 'chart', 'facts', 'stack', 'pick'])

export function Bubble({ message, busy, isLast, onSend }: Props) {
  // 글이 타자를 치듯 다 나타난 뒤에 카드, 그래프, 버튼 같은 나머지 내용을 보여줘요.
  const [typed, setTyped] = useState(!(message.from === 'bot' && message.live))
  if (message.from === 'user') {
    return (
      <div className="flex animate-rise justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-[15px] leading-relaxed text-white">
          {message.text}
        </p>
      </div>
    )
  }

  const { event, request } = message
  const wide = WIDE_TYPES.has(event.type)
  const locked = busy || !isLast

  const repo = request ? repoLabel(request.url) : 'unknown'

  const choose = (excludeGenerated: boolean) => {
    if (!request) return
    track('calc_mode_select', { repo, exclude_generated: excludeGenerated })
    onSend(
      { url: request.url, excludeGenerated },
      excludeGenerated ? '빼고 계산해 주세요.' : '전부 포함해서 계산해 주세요.',
    )
  }

  const ask = (question: FollowupQuestion, userText: string, person?: string) => {
    if (!request) return
    track('followup_ask', { repo, question, has_person: person !== undefined })
    onSend({ url: request.url, question, person }, userText)
  }

  const pick = (ids: string[], userText: string, mode: 'top' | 'custom') => {
    if (!request) return
    track('people_pick', { repo, mode, count: ids.length })
    onSend({ url: request.url, excludeGenerated: request.excludeGenerated, people: ids }, userText)
  }

  const retry = () => {
    if (!request) return
    track('retry_click', { repo, question: request.question ?? 'analysis' })
    onSend(request)
  }

  return (
    <div className="flex animate-rise justify-start">
      <div
        className={`rounded-2xl rounded-bl-md bg-gray-100 px-4 py-2.5 text-[15px] leading-relaxed text-gray-900 ${
          wide ? 'w-full pb-4' : 'max-w-[85%]'
        }`}
      >
        <p className="whitespace-pre-line">
          <RichText text={event.text} typed={message.live} onDone={() => setTyped(true)} />
        </p>

        {typed && <div className="animate-rise">{renderExtras()}</div>}
      </div>
    </div>
  )

  function renderExtras() {
    if (message.from !== 'bot') return null
    return (
      <>

        {event.type === 'ranking' && <RankingCarousel contributors={event.contributors} />}

        {event.type === 'list' && (
          <ul className="mt-3 mb-1.5 divide-y divide-gray-100 rounded-xl bg-white px-4">
            {event.items.map((item, index) => (
              <li key={`${index}:${item}`} className="flex gap-3 py-2.5 text-[14px] leading-snug">
                <span className="w-4 shrink-0 text-xs leading-5 font-semibold text-brand tabular-nums">{index + 1}</span>
                <span className="min-w-0">
                  <RichText text={item} />
                </span>
              </li>
            ))}
          </ul>
        )}

        {event.type === 'summary' && (
          <SummaryChart contributors={event.contributors} othersCount={event.othersCount} />
        )}

        {event.type === 'stack' && (
          <dl className="mt-3 mb-1.5 divide-y divide-gray-100 rounded-xl bg-white px-4">
            {event.groups.map((group) => (
              <div key={group.category} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-baseline sm:gap-4">
                <dt className="shrink-0 text-xs font-medium text-gray-500 sm:w-24">{group.category}</dt>
                <dd className="flex min-w-0 flex-wrap gap-1.5">
                  {group.items.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-brand-soft px-2.5 py-1 text-[13px] leading-none font-medium text-brand-hover"
                    >
                      {item}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {event.type === 'chart' && <Charts charts={event.charts} />}

        {event.type === 'facts' && <Facts items={event.items} />}

        {event.type === 'followup' && request && <Followup people={event.people} disabled={locked} onAsk={ask} />}

        {event.type === 'pick' && request && (
          <PeoplePicker people={event.people} top={event.top} max={event.max} disabled={locked} onPick={pick} />
        )}

        {event.type === 'ask' && request && (
          <div className="mb-1.5 flex flex-wrap gap-2">
            <button type="button" disabled={locked} onClick={() => choose(false)} className={actionButton}>
              전부 포함하기
            </button>
            <button type="button" disabled={locked} onClick={() => choose(true)} className={quietButton}>
              빼고 계산하기
            </button>
          </div>
        )}

        {event.type === 'error' && event.action === 'retry' && request && (
          <div>
            <button type="button" disabled={locked} onClick={retry} className={`${actionButton} mb-1.5`}>
              다시 시도
            </button>
          </div>
        )}
      </>
    )
  }
}
