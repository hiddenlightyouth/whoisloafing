// Node에서 직접 돌릴 때(개발 서버, npm start)의 진입점이에요. .env 파일은 여기서만 읽어요.
import 'dotenv/config'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { env } from './env.ts'
import { getConfig, readChat, readOwnerKey, shareChatById, SSE_HEADERS, streamAnalysis } from './handlers.ts'

const app = express()
app.disable('x-powered-by')
if (env.isProduction) app.set('trust proxy', 1)

app.use(express.json({ limit: '10kb' }))

app.get('/api/config', (_req, res) => {
  const result = getConfig()
  res.status(result.status).json(result.body)
})

app.get('/api/chats/:id', async (req, res) => {
  const result = await readChat(req.params.id, readOwnerKey(req.get('x-owner-key')))
  res.status(result.status).set('Cache-Control', 'no-store').json(result.body)
})

app.post('/api/chats/:id/share', async (req, res) => {
  const result = await shareChatById(req.params.id, readOwnerKey(req.get('x-owner-key')))
  res.status(result.status).json(result.body)
})

app.post('/api/analyze', async (req, res) => {
  res.writeHead(200, { ...SSE_HEADERS, Connection: 'keep-alive' })
  let closed = false
  res.on('close', () => {
    closed = true
  })
  await streamAnalysis({
    body: req.body,
    ownerKey: readOwnerKey(req.get('x-owner-key')),
    ip: req.ip ?? 'unknown',
    write: (chunk) => {
      if (!closed) res.write(chunk)
    },
    isClosed: () => closed,
  })
  res.end()
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
