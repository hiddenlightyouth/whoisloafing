import 'dotenv/config'
import { randomBytes } from 'node:crypto'

const isProduction = process.env.NODE_ENV === 'production'

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (secret) return secret
  if (isProduction) throw new Error('SESSION_SECRET 환경 변수가 필요해요.')
  console.warn('SESSION_SECRET이 없어서 임시 값을 사용해요. 서버를 다시 시작하면 로그인이 풀려요.')
  return randomBytes(32).toString('hex')
}

export const env = {
  isProduction,
  port: Number(process.env.PORT) || 3001,
  appUrl: (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, ''),
  githubToken: process.env.GITHUB_TOKEN || undefined,
  githubClientId: process.env.GITHUB_CLIENT_ID || undefined,
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET || undefined,
  geminiApiKey: process.env.GEMINI_API_KEY || undefined,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  sessionSecret: sessionSecret(),
}
