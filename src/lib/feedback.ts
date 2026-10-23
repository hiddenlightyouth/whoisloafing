import { createStore, useStore } from './store'
import { authFetch } from './auth'

/** 서버에 보내는 피드백. 평가는 분석이 어땠는지, 버그는 문제가 생겼다는 신고예요. */
export interface FeedbackInput {
  kind: 'RATING' | 'BUG'
  rating?: 'GOOD' | 'BAD'
  comment?: string
  chatId?: string | null
}

/** 평가나 버그 신고를 보내요. 지금 보고 있는 화면의 주소 경로를 함께 보내요. 로그인하지 않아도 보낼 수 있어요. */
export async function sendFeedback(input: FeedbackInput): Promise<boolean> {
  try {
    const result = await authFetch<null>('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, chatId: input.chatId ?? undefined, page: window.location.pathname.slice(0, 200) }),
    })
    return result.ok
  } catch {
    return false
  }
}

/** ready는 서버가 피드백을 받을 수 있는지, bugOpen은 버그 신고 창이 떠 있는지예요. */
const state = createStore({ ready: false, bugOpen: false })

const setState = (next: Partial<ReturnType<typeof state.get>>) => state.set({ ...state.get(), ...next })

export const setFeedbackReady = (ready: boolean) => setState({ ready })
export const openBugReport = () => setState({ bugOpen: true })
export const closeBugReport = () => setState({ bugOpen: false })

export function useFeedback() {
  return useStore(state)
}

const COUNT_KEY = 'whoisloafing:feedback-answers'
const ASKED_KEY = 'whoisloafing:feedback-asked'
/** 답을 이만큼 받은 뒤에, 마지막으로 물어본 지 이만큼 지났을 때만 어땠는지 물어봐요. 아주 가끔만 묻게 하려는 값이에요. */
const ASK_AFTER_ANSWERS = 5
const ASK_GAP_MS = 14 * 86_400_000

/**
 * 분석의 답을 하나 받을 때마다 불러요. 지금 어땠는지 물어볼 때가 됐으면 true를 돌려주고, 다음에 물어볼 때까지 다시 세기 시작해요.
 * 저장하지 못하는 브라우저에서는 묻지 않아요.
 */
export function shouldAskFeedback(): boolean {
  try {
    const answers = (Number(localStorage.getItem(COUNT_KEY)) || 0) + 1
    const asked = Number(localStorage.getItem(ASKED_KEY)) || 0
    if (answers < ASK_AFTER_ANSWERS || Date.now() - asked < ASK_GAP_MS) {
      localStorage.setItem(COUNT_KEY, String(answers))
      return false
    }
    localStorage.setItem(COUNT_KEY, '0')
    localStorage.setItem(ASKED_KEY, String(Date.now()))
    return true
  } catch {
    return false
  }
}
