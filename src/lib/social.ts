import { confirmSocialLink, createSocialLinkTicket, linkSocial, signInSocial, type AuthOutcome } from './auth'
import { getLang, messages, pick } from './i18n'

export type SocialProvider = 'github' | 'kakao'

/** 서비스 이름. 카카오는 언어에 맞춰 적어서, 읽을 때마다 지금 언어의 이름을 돌려줘요. */
export const SOCIAL_LABELS: Record<SocialProvider, string> = {
  github: 'GitHub',
  get kakao() {
    return getLang() === 'en' ? 'Kakao' : '카카오'
  },
}

const TEXT = messages({
  ko: {
    canceled: (name: string) => `${name} 로그인을 취소했어요.`,
    invalid: '로그인 요청을 확인하지 못했어요. 처음부터 다시 시도해 주세요.',
  },
  en: {
    canceled: (name: string) => `${name} sign-in was canceled.`,
    invalid: "We couldn't verify the sign-in request. Please start over.",
  },
})

/** 소셜 로그인으로 무엇을 하려는지. login은 로그인(처음이면 가입), link는 로그인한 내 계정에 연결이에요. */
export type SocialMode = 'login' | 'link'

interface Pending {
  state: string
  provider: SocialProvider
  mode: SocialMode
  /** 끝나면 돌아갈 주소 (경로와 쿼리) */
  returnTo: string
}

const STORAGE = 'whoisloafing:social'
const CALLBACK_PATH = /^\/auth\/(github|kakao)\/callback\/?$/

const AUTHORIZE_URLS: Record<SocialProvider, string> = {
  github: 'https://github.com/login/oauth/authorize',
  kakao: 'https://kauth.kakao.com/oauth/authorize',
}

/** 돌아올 주소. 소셜 서비스에 등록해 둔 주소와 글자 하나까지 같아야 해요. */
const redirectUri = (provider: SocialProvider) => `${window.location.origin}/auth/${provider}/callback`

/** 지금 주소가 소셜 로그인에서 돌아온 주소면 어느 서비스인지 돌려줘요. */
export function socialFromPath(): SocialProvider | null {
  const match = CALLBACK_PATH.exec(window.location.pathname)
  return match ? (match[1] as SocialProvider) : null
}

/**
 * 소셜 서비스의 로그인 화면으로 보내요. 돌아왔을 때 내가 보낸 요청이 맞는지 확인하려고,
 * 무작위 값(state)을 이 탭에 적어 두고 같이 보내요.
 */
export function startSocial(provider: SocialProvider, clientId: string, mode: SocialMode, returnTo: string): void {
  const state = crypto.randomUUID()
  const pending: Pending = { state, provider, mode, returnTo }
  try {
    sessionStorage.setItem(STORAGE, JSON.stringify(pending))
  } catch {
    // 적어 두지 못하면 돌아왔을 때 확인할 수 없어서, 그때 다시 시도하라고 안내해요.
  }
  window.location.assign(authorizeUrl(provider, clientId, state))
}

function authorizeUrl(provider: SocialProvider, clientId: string, state: string): string {
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri(provider), state })
  if (provider === 'github') params.set('scope', 'read:user user:email')
  else params.set('response_type', 'code')
  return `${AUTHORIZE_URLS[provider]}?${params}`
}

/** 앱에서 시작한 연결은 state 앞에 이 표시를 붙여요. 브라우저가 돌아왔을 때 이 표시로 알아봐요. */
const APP_STATE_PREFIX = 'app.'

/**
 * 앱에서 내 계정에 소셜 계정을 연결해요. 앱은 바깥 주소를 기본 브라우저로 넘기기 때문에, 연결은 브라우저에서 마무리돼요.
 * 브라우저는 앱의 로그인을 모르니, 어느 계정에 연결할지 알려 주는 일회용 값을 서버에서 받아 같이 보내요.
 * 받지 못하면 false를 돌려줘요.
 */
export async function startSocialFromApp(provider: SocialProvider, clientId: string): Promise<boolean> {
  const ticket = await createSocialLinkTicket(provider)
  if (!ticket) return false
  window.location.assign(authorizeUrl(provider, clientId, `${APP_STATE_PREFIX}${ticket}`))
  return true
}

/** 앱에서 시작한 연결로 돌아온 주소면, 연결에 쓸 일회용 값과 코드를 돌려줘요. */
export function appLinkFromLocation(): { ticket: string; code: string | null } | null {
  const params = new URLSearchParams(window.location.search)
  const state = params.get('state') ?? ''
  if (!state.startsWith(APP_STATE_PREFIX)) return null
  return { ticket: state.slice(APP_STATE_PREFIX.length), code: params.get('error') ? null : params.get('code') }
}

/** 앱에서 시작한 연결을 브라우저에서 마무리해요. */
export const finishAppLink = (provider: SocialProvider, ticket: string, code: string) => confirmSocialLink(provider, ticket, code, redirectUri(provider))

export interface SocialResult {
  outcome: AuthOutcome
  mode: SocialMode
  returnTo: string
}

const FALLBACK_RETURN = '/history'

/** 소셜 서비스에서 돌아온 뒤에 불러요. 보낸 요청이 맞는지 확인하고, 받은 코드로 로그인하거나 계정에 연결해요. */
export async function finishSocial(provider: SocialProvider): Promise<SocialResult> {
  const params = new URLSearchParams(window.location.search)
  let pending: Pending | null = null
  try {
    pending = JSON.parse(sessionStorage.getItem(STORAGE) ?? 'null') as Pending | null
    sessionStorage.removeItem(STORAGE)
  } catch {
    pending = null
  }
  const mode = pending?.mode ?? 'login'
  // 돌아갈 주소는 이 사이트 안의 경로만 받아요.
  const returnTo = pending?.returnTo.startsWith('/') && !pending.returnTo.startsWith('//') ? pending.returnTo : FALLBACK_RETURN
  const fail = (message: string): SocialResult => ({ outcome: { ok: false, message }, mode, returnTo })

  const code = params.get('code')
  if (params.get('error') || !code) return fail(pick(TEXT).canceled(SOCIAL_LABELS[provider]))
  if (!pending || pending.provider !== provider || pending.state !== params.get('state')) {
    return fail(pick(TEXT).invalid)
  }

  const outcome = mode === 'link' ? await linkSocial(provider, code, redirectUri(provider)) : await signInSocial(provider, code, redirectUri(provider))
  return { outcome, mode, returnTo }
}
