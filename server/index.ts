import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import session from 'express-session'
import { authRouter } from './auth.ts'
import { env } from './env.ts'

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

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
