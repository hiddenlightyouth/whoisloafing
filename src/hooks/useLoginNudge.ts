import { useCallback, useState } from 'react'
import { track } from '../lib/analytics'
import { readItem, writeItem } from '../lib/storage'

const NUDGE_DISMISSED_KEY = 'whoisloafing:login-nudge-dismissed'
/** 좁은 화면에서 로그인 안내를 닫은 뒤, 채팅을 이만큼 새로 시작하면 다시 띄워요. */
const NUDGE_REOPEN_CHATS = 3

/** 로그인 안내를 닫은 뒤에 새로 시작한 채팅 수. 닫은 적이 없으면 null이에요. */
function nudgeChatsSinceClose(): number | null {
  const value = readItem(NUDGE_DISMISSED_KEY)
  return value === null ? null : Number(value) || 0
}

const storeNudge = (chats: number | null) => writeItem(NUDGE_DISMISSED_KEY, chats === null ? null : String(chats))

/** 로그인 안내를 닫아 뒀는지와, 닫고 열고 새 채팅을 셀 때 부르는 함수 */
export function useLoginNudge() {
  const [closed, setClosed] = useState(() => nudgeChatsSinceClose() !== null)

  const close = useCallback(() => {
    track('login_nudge_close')
    setClosed(true)
    storeNudge(0)
  }, [])

  const open = useCallback(() => {
    track('login_nudge_open')
    setClosed(false)
    storeNudge(null)
  }, [])

  /** 새 채팅을 시작할 때 불러요. 좁은 화면에서는 닫아 둔 안내를 채팅 몇 번마다 다시 띄워요. 넓은 화면에서는 떠 있는 아이콘이 대신해요. */
  const countChat = useCallback(() => {
    const closedFor = nudgeChatsSinceClose()
    if (closedFor === null || window.matchMedia('(min-width: 768px)').matches) return
    const reopen = closedFor + 1 >= NUDGE_REOPEN_CHATS
    storeNudge(reopen ? null : closedFor + 1)
    if (reopen) setClosed(false)
  }, [])

  return { closed, close, open, countChat }
}
