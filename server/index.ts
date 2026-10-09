import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
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
import { env } from './env.ts'
import { getChat, hashOwnerKey, isUuid, saveMessages, shareChat, storageEnabled, type StoredChat } from './store.ts'

// 분석 요청 횟수 제한 (IP 기준)
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

const app = express()
app.disable('x-powered-by')
if (env.isProduction) app.set('trust proxy', 1)

app.use(express.json({ limit: '10kb' }))
/** 브라우저가 만들어서 보내는 소유자 키. 채팅을 만든 브라우저만 이어서 쓸 수 있게 해요. */
function readOwnerKey(req: express.Request): string | null {
  const key = req.get('x-owner-key')
  return key && key.length >= 16 && key.length <= 100 ? key : null
}

// 클라이언트가 저장과 공유 기능을 보여줄지 정하는 데 써요.
app.get('/api/config', (_req, res) => {
  res.json({ storage: storageEnabled })
})

// 저장된 채팅을 불러와요. 공유되지 않은 채팅은 만든 브라우저만 볼 수 있어요.
app.get('/api/chats/:id', async (req, res) => {
  try {
    const chat = storageEnabled && isUuid(req.params.id) ? await getChat(req.params.id) : null
    if (!chat) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    const ownerKey = readOwnerKey(req)
    const owner = !!ownerKey && hashOwnerKey(ownerKey) === chat.ownerKeyHash
    if (!chat.sharedAt && !owner) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const snapshot: ChatSnapshot = {
      id: chat.id,
      repoUrl: chat.repoUrl,
      shared: !!chat.sharedAt,
      owner,
      messages: chat.messages,
    }
    res.set('Cache-Control', 'no-store').json(snapshot)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server_error' })
  }
})

// 채팅을 공유해요. 공유한 뒤에는 누구나 열람할 수 있고, 더 이상 이어서 작업할 수 없어요.
app.post('/api/chats/:id/share', async (req, res) => {
  try {
    const chat = storageEnabled && isUuid(req.params.id) ? await getChat(req.params.id) : null
    const ownerKey = readOwnerKey(req)
    if (!chat) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    if (!ownerKey || hashOwnerKey(ownerKey) !== chat.ownerKeyHash) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    if (!chat.sharedAt) await shareChat(chat.id)
    res.json({ shared: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server_error' })
  }
})

// 분석 결과를 준비되는 대로 SSE로 한 메시지씩 흘려보내요.
app.post('/api/analyze', async (req, res) => {
  const body = (req.body ?? {}) as Partial<AnalyzeRequest>

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  let closed = false
  res.on('close', () => {
    closed = true
  })
  // 화면에 올라가는 말풍선은 채팅을 저장할 때 쓰려고 따로 모아 둬요.
  const sent: StoredMessage[] = []
  let request: AnalyzeRequest | undefined
  const emit = (event: ChatEvent) => {
    if (event.type !== 'done' && event.type !== 'pause') sent.push({ from: 'bot', event, request })
    if (!closed) res.write(`data: ${JSON.stringify(event)}\n\n`)
  }
  const heartbeat = setInterval(() => {
    if (!closed) res.write(': ping\n\n')
  }, 15000)

  // 저장에 필요한 값이 모두 있을 때만 채팅을 저장해요.
  const ownerKey = readOwnerKey(req)
  const chatId = storageEnabled && isUuid(body.chatId) && ownerKey ? body.chatId : undefined
  let existing: StoredChat | null = null

  try {
    if (typeof body.url !== 'string' || !body.url.trim() || body.url.length > 300) {
      emit({ type: 'error', text: '레포 링크를 입력해 주세요.' })
    } else if (!allowRequest(req.ip ?? 'unknown')) {
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
            isAborted: () => closed,
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
    res.end()
  }
})

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'not_found' })
})

// 프로덕션에서는 빌드된 프론트엔드를 함께 서빙해요.
const clientDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')
if (env.isProduction && existsSync(clientDir)) {
  app.use(express.static(clientDir))
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next()
    res.sendFile(path.join(clientDir, 'index.html'))
  })
}

app.listen(env.port, () => {
  console.log(`WhoIsLoafing 서버가 http://localhost:${env.port} 에서 실행 중이에요.`)
})
