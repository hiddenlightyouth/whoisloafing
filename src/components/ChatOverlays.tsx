import { useEffect, useRef, useState, type RefObject } from 'react'
import type { ChatMessage } from '../hooks/useAnalysis'
import { track } from '../lib/analytics'
import { isApp } from '../lib/app'
import { shouldAskFeedback, useFeedback } from '../lib/feedback'
import { AppNudge } from './AppNudge'
import { DeepNudge, shouldNudgeDeep } from './DeepNudge'
import { BugReport, FeedbackPrompt } from './Feedback'
import { LoginNudge } from './LoginNudge'

interface Props {
  messages: ChatMessage[]
  busy: boolean
  chatId: RefObject<string | null>
  /** 공유된 채팅이나 다른 브라우저에서 만든 채팅이라 읽기만 하는지 */
  readOnly: boolean
  /** 계정 화면을 보고 있는지. 채팅을 들고 로그인하러 가 있는 동안에는 평가와 심층 분석 안내를 띄우지 않아요. */
  inAccount: boolean
  /** 떠나기 확인 창이 떠 있는지. 떠 있는 동안에는 안내 카드를 숨겨요. */
  leaving: boolean
  /** 서버에 심층 분석 API가 있는지 */
  deep: boolean
  /** 보고 있는 채팅의 레포(소유자/레포) */
  chatRepo: string | null
  onDeep: (repo: string) => void
  /** 로그인하지 않고 분석하는 동안 로그인을 권하는지 */
  nudging: boolean
  nudgeClosed: boolean
  onNudgeLogin: () => void
  onNudgeClose: () => void
  onNudgeOpen: () => void
  /** 웹에서 채팅을 보는 Mac 사용자에게 앱을 권하는지 */
  appNudging: boolean
}

/** 채팅 화면에 떠 있는 안내 카드들(로그인 안내, 앱 안내, 평가, 심층 분석 안내)과 버그 신고 창이에요. */
export function ChatOverlays({
  messages,
  busy,
  chatId,
  readOnly,
  inAccount,
  leaving,
  deep,
  chatRepo,
  onDeep,
  nudging,
  nudgeClosed,
  onNudgeLogin,
  onNudgeClose,
  onNudgeOpen,
  appNudging,
}: Props) {
  const feedback = useFeedback()
  /** 분석이 어땠는지 묻는 카드가 떠 있는지. 아주 가끔만 띄워요. */
  const [askingFeedback, setAskingFeedback] = useState(false)
  const wasBusy = useRef(false)
  /** 앱에서 심층 분석을 권하고 있는 채팅의 ID. 채팅마다 기본 분석이 끝났을 때 한 번만 권해요. */
  const [deepNudge, setDeepNudge] = useState<string | null>(null)
  const deepNudged = useRef<string | null>(null)

  // 내 채팅에서 답을 하나 다 받을 때마다 세다가, 때가 되면 분석이 어땠는지 물어봐요.
  useEffect(() => {
    const finished = wasBusy.current && !busy
    wasBusy.current = busy
    if (!finished || readOnly || !messages.some((message) => message.from === 'bot')) return
    if (feedback.ready && shouldAskFeedback()) setAskingFeedback(true)
    // 앱에서는 레포의 기본 분석(첫 답)이 끝났을 때, 같은 레포를 심층 분석으로 볼 수 있다고 한 번 알려줘요.
    const last = messages[messages.length - 1]
    const failed = last?.from === 'bot' && last.event.type === 'error'
    const id = chatId.current
    if (isApp && deep && id && deepNudged.current !== id && !failed && shouldNudgeDeep()) {
      deepNudged.current = id
      setDeepNudge(id)
    }
  }, [busy, chatId, deep, feedback.ready, messages, readOnly])

  useEffect(() => {
    if (nudging && !nudgeClosed) track('login_nudge_view')
  }, [nudging, nudgeClosed])

  const hasChat = messages.length > 0

  return (
    <>
      {nudging && !leaving && <LoginNudge collapsed={nudgeClosed} onLogin={onNudgeLogin} onClose={onNudgeClose} onOpen={onNudgeOpen} />}
      {appNudging && !leaving && <AppNudge raised={nudging} />}
      {askingFeedback && hasChat && !inAccount && !leaving && !(nudging && !nudgeClosed) && (
        <FeedbackPrompt chatId={chatId.current} onClose={() => setAskingFeedback(false)} />
      )}
      {deepNudge && deepNudge === chatId.current && hasChat && !inAccount && !askingFeedback && chatRepo?.includes('/') && (
        <DeepNudge
          onClose={() => setDeepNudge(null)}
          onDeep={() => {
            setDeepNudge(null)
            track('deep_open', { from: 'nudge', repo: chatRepo })
            onDeep(chatRepo)
          }}
        />
      )}
      {feedback.bugOpen && <BugReport chatId={hasChat ? chatId.current : null} />}
    </>
  )
}
