import {
  FOLLOWUP_LABELS,
  type AnalyzeRequest,
  type ChatEvent,
  type ChatSnapshot,
  type FollowupQuestion,
  type StoredMessage,
} from '../shared/types.ts'
import { runAnalysis } from './analyze.ts'
import { requestContext } from './context.ts'
import { getChat, hashOwnerKey, isUuid, saveMessages, shareChat, storageEnabled, type StoredChat } from './store.ts'

/**
 * API의 실제 동작이에요. 어디서 돌아가는지와 상관없이 같은 코드를 쓰려고 여기에 모아 뒀어요.
 * Express(server/index.ts)와 Cloudflare Pages Functions(functions/api)가 둘 다 이 파일을 불러서 써요.
 */

// 분석 요청 횟수 제한 (IP 기준). 메모리에만 두기 때문에 서버가 여러 개로 나뉘면 서버마다 따로 세요.
const RATE_WINDOW_MS = 10 * 60 * 1000
const RATE_MAX_REQUESTS = 60
const recentRequests = new Map<string, number[]>()

function allowRequest(ip: string): boolean {
  const now = Date.now()
  const times = (recentRequests.get(ip) ?? []).filter((time) => now - time < RATE_WINDOW_MS)
  if (times.length >= RATE_MAX_REQUESTS) {
    recentRequests.set(ip, times)
    return false
  }
  times.push(now)
  recentRequests.set(ip, times)
  if (recentRequests.size > 5000) recentRequests.clear()
  return true
}

export interface JsonResult {
  status: number
  body: unknown
}

/** 브라우저가 만들어서 보내는 소유자 키. 채팅을 만든 브라우저만 이어서 쓸 수 있게 해요. */
export function readOwnerKey(value: string | null | undefined): string | null {
  return value && value.length >= 16 && value.length <= 100 ? value : null
}

/** 클라이언트가 저장과 공유 기능을 보여줄지 정하는 데 써요. */
export function getConfig(): JsonResult {
  return { status: 200, body: { storage: storageEnabled() } }
}

/** 저장된 채팅을 불러와요. 공유되지 않은 채팅은 만든 브라우저만 볼 수 있어요. */
export async function readChat(id: string, ownerKey: string | null): Promise<JsonResult> {
  try {
    const chat = storageEnabled() && isUuid(id) ? await getChat(id) : null
    if (!chat) return { status: 404, body: { error: 'not_found' } }
    const owner = !!ownerKey && hashOwnerKey(ownerKey) === chat.ownerKeyHash
    if (!chat.sharedAt && !owner) return { status: 403, body: { error: 'forbidden' } }
    const snapshot: ChatSnapshot = {
      id: chat.id,
      repoUrl: chat.repoUrl,
      shared: !!chat.sharedAt,
      owner,
      messages: chat.messages,
    }
    return { status: 200, body: snapshot }
  } catch (err) {
    console.error(err)
    return { status: 500, body: { error: 'server_error' } }
  }
}

/** 채팅을 공유해요. 공유한 뒤에는 누구나 열람할 수 있고, 더 이상 이어서 작업할 수 없어요. */
export async function shareChatById(id: string, ownerKey: string | null): Promise<JsonResult> {
  try {
    const chat = storageEnabled() && isUuid(id) ? await getChat(id) : null
    if (!chat) return { status: 404, body: { error: 'not_found' } }
    if (!ownerKey || hashOwnerKey(ownerKey) !== chat.ownerKeyHash) return { status: 403, body: { error: 'forbidden' } }
    if (!chat.sharedAt) await shareChat(chat.id)
    return { status: 200, body: { shared: true } }
  } catch (err) {
    console.error(err)
    return { status: 500, body: { error: 'server_error' } }
  }
}

export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  'X-Accel-Buffering': 'no',
}

/**
 * 분석 결과를 준비되는 대로 SSE로 한 메시지씩 흘려보내요.
 * write는 받은 글을 그대로 응답에 쓰는 함수이고, isClosed는 사용자가 연결을 끊었는지 알려줘요.
 */
export async function streamAnalysis(options: {
  body: unknown
  ownerKey: string | null
  ip: string
  write: (chunk: string) => void
  isClosed: () => boolean
}): Promise<void> {
  const body = (options.body && typeof options.body === 'object' ? options.body : {}) as Partial<AnalyzeRequest>
  const { ownerKey, write, isClosed } = options

  // 화면에 올라가는 말풍선은 채팅을 저장할 때 쓰려고 따로 모아 둬요.
  const sent: StoredMessage[] = []
  let request: AnalyzeRequest | undefined
  const emit = (event: ChatEvent) => {
    if (event.type !== 'done' && event.type !== 'pause') sent.push({ from: 'bot', event, request })
    if (!isClosed()) write(`data: ${JSON.stringify(event)}\n\n`)
  }
  const heartbeat = setInterval(() => {
    if (!isClosed()) write(': ping\n\n')
  }, 15000)

  // 저장에 필요한 값이 모두 있을 때만 채팅을 저장해요.
  const chatId = storageEnabled() && isUuid(body.chatId) && ownerKey ? body.chatId : undefined
  let existing: StoredChat | null = null

  try {
    if (typeof body.url !== 'string' || !body.url.trim() || body.url.length > 300) {
      emit({ type: 'error', text: '레포 링크를 입력해 주세요.' })
    } else if (!allowRequest(options.ip)) {
      emit({ type: 'error', text: '요청이 너무 많아요. 잠시 뒤에 다시 시도해 주세요.', action: 'retry' })
    } else {
      request = {
        url: body.url.trim(),
        excludeGenerated: typeof body.excludeGenerated === 'boolean' ? body.excludeGenerated : undefined,
        question:
          typeof body.question === 'string' && Object.hasOwn(FOLLOWUP_LABELS, body.question)
            ? (body.question as FollowupQuestion)
            : undefined,
        person: typeof body.person === 'string' ? body.person.slice(0, 100) : undefined,
        people: Array.isArray(body.people)
          ? body.people.filter((id): id is string => typeof id === 'string' && id.length <= 100).slice(0, 10)
          : undefined,
      }

      if (chatId) existing = await getChat(chatId)
      if (existing?.sharedAt) {
        emit({ type: 'error', text: '공유한 채팅에서는 더 이상 분석을 이어갈 수 없어요.' })
      } else if (existing && existing.ownerKeyHash !== hashOwnerKey(ownerKey!)) {
        emit({ type: 'error', text: '이 채팅은 다른 브라우저에서 만든 채팅이라 이어서 쓸 수 없어요.' })
      } else {
        await requestContext.run({ chatId }, () =>
          runAnalysis({
            ...request!,
            excludeGenerated: request!.excludeGenerated,
            timeZone: typeof body.timeZone === 'string' ? body.timeZone.slice(0, 64) : undefined,
            emit,
            isAborted: isClosed,
          }),
        )

        if (chatId) {
          const userText = typeof body.userText === 'string' ? body.userText.trim().slice(0, 300) : ''
          await saveMessages({
            id: chatId,
            repoUrl: request.url,
            ownerKeyHash: hashOwnerKey(ownerKey!),
            existing,
            added: [...(userText ? [{ from: 'user' as const, text: userText }] : []), ...sent],
          }).catch((err) => console.error(err))
        }
      }
    }
  } catch (err) {
    console.error(err)
    emit({ type: 'error', text: '분석 중에 문제가 생겼어요. 잠시 뒤에 다시 시도해 주세요.', action: 'retry' })
  } finally {
    clearInterval(heartbeat)
    emit({ type: 'done' })
  }
}
