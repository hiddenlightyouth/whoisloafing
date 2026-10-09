import { randomBytes, timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import type { SessionUser } from '../shared/types.ts'
import { env } from './env.ts'

declare module 'express-session' {
  interface SessionData {
    oauthState?: string
    /** GitHub 액세스 토큰. 서버 세션에만 보관하고 클라이언트로는 절대 보내지 않아요. */
    token?: string
    user?: { id: number; login: string; avatarUrl: string }
  }
}

const CALLBACK_PATH = '/api/auth/github/callback'

export const authRouter = Router()

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

authRouter.get('/github', (req, res) => {
  if (!env.githubClientId || !env.githubClientSecret) {
    res.redirect(`${env.appUrl}/?login=failed`)
    return
  }
  const state = randomBytes(24).toString('hex')
  req.session.oauthState = state
  const query = new URLSearchParams({
    client_id: env.githubClientId,
    redirect_uri: `${env.appUrl}${CALLBACK_PATH}`,
    scope: 'repo',
    state,
  })
  req.session.save(() => res.redirect(`https://github.com/login/oauth/authorize?${query}`))
})

authRouter.get('/github/callback', async (req, res) => {
  const fail = () => res.redirect(`${env.appUrl}/?login=failed`)

  const code = typeof req.query.code === 'string' ? req.query.code : ''
  const state = typeof req.query.state === 'string' ? req.query.state : ''
  const expected = req.session.oauthState
  delete req.session.oauthState
  if (!code || !state || !expected || !safeEqual(state, expected)) return fail()

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.githubClientId,
        client_secret: env.githubClientSecret,
        code,
        redirect_uri: `${env.appUrl}${CALLBACK_PATH}`,
      }),
    })
    const { access_token: token } = (await tokenRes.json()) as { access_token?: string }
    if (!token) return fail()

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'whoisloafing',
      },
    })
    if (!userRes.ok) return fail()
    const profile = (await userRes.json()) as { id: number; login: string; avatar_url: string }

    // 로그인 시점에 세션 ID를 새로 발급해서 세션 고정 공격을 막아요.
    req.session.regenerate((err) => {
      if (err) return fail()
      req.session.token = token
      req.session.user = { id: profile.id, login: profile.login, avatarUrl: profile.avatar_url }
      req.session.save(() => res.redirect(`${env.appUrl}/`))
    })
  } catch (err) {
    console.error(err)
    fail()
  }
})

authRouter.get('/me', (req, res) => {
  const user = req.session.user
  const body: { user: SessionUser | null } = {
    user: user ? { login: user.login, avatarUrl: user.avatarUrl } : null,
  }
  res.set('Cache-Control', 'no-store').json(body)
})

authRouter.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('wil.sid').json({ ok: true })
  })
})
