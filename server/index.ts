import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import session from 'express-session'
import type { AnalyzeRequest, ChatEvent } from '../shared/types.ts'
import { runAnalysis } from './analyze.ts'
import { authRouter } from './auth.ts'
import { env } from './env.ts'

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

// 분석 요청 횟수 제한 (IP 기준)
const RATE_WINDOW_MS = 10 * 60 * 1000
const RATE_MAX_REQUESTS = 20
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
app.use(
  session({
    name: 'wil.sid',
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.isProduction,
      maxAge: SESSION_MAX_AGE_MS,
    },
  }),
)

app.use('/api/auth', authRouter)

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
  const emit = (event: ChatEvent) => {
    if (!closed) res.write(`data: ${JSON.stringify(event)}\n\n`)
  }
  const heartbeat = setInterval(() => {
    if (!closed) res.write(': ping\n\n')
  }, 15000)

  try {
    if (typeof body.url !== 'string' || !body.url.trim() || body.url.length > 300) {
      emit({ type: 'error', text: '레포 링크를 입력해 주세요.' })
    } else if (!allowRequest(req.ip ?? 'unknown')) {
      emit({ type: 'error', text: '요청이 너무 많아요. 잠시 뒤에 다시 시도해 주세요.' })
    } else {
      const { user, token } = req.session
      await runAnalysis({
        url: body.url,
        excludeGenerated: typeof body.excludeGenerated === 'boolean' ? body.excludeGenerated : undefined,
        requester: user && token ? { id: user.id, token } : null,
        emit,
        isAborted: () => closed,
      })
    }
  } catch (err) {
    console.error(err)
    emit({ type: 'error', text: '분석 중에 문제가 생겼어요. 잠시 뒤에 다시 시도해 주세요.' })
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
