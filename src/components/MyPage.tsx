import { useCallback, useEffect, useState } from 'react'
import { track } from '../lib/analytics'
import {
  describeDevice,
  fetchLoginHistory,
  fetchSessions,
  loadMe,
  revokeSession,
  signOut,
  unlinkSocial,
  withdraw,
  useAuth,
  type DeviceSession,
  type LoginRecord,
} from '../lib/auth'
import { formatDate, formatDateTime, parseServerTime } from '../lib/format'
import { loadConfig } from '../lib/api'
import { showToast } from '../lib/toast'
import { pageFrame, PageHeader } from './AppPage'
import { ConfirmDialog } from './Dialog'
import { isApp } from '../lib/app'
import { SOCIAL_LABELS, type SocialProvider } from '../lib/social'
import { IpPlace } from './IpPlace'
import { SocialButtons, useSocialClients } from './Social'
import { Bone } from './Skeleton'
import { messages, pick, useMessages } from '../lib/i18n'
import { CheckIcon } from './Icons'

const TEXT = messages({
  ko: {
    loading: '불러오고 있어요.',
    unlinked: (name: string) => `${name} 연결을 해제했어요.`,
    social: '소셜 로그인',
    linked: '연결됨',
    unlink: '해제',
    link: '연결',
    unlinkTitle: (name: string) => `${name} 연결을 해제할까요?`,
    unlinkBody: (name: string) => `해제하면 ${name} 계정으로는 이 계정에 로그인할 수 없어요. 나중에 다시 연결할 수 있어요.`,
    revokeFailed: '기기를 로그아웃시키지 못했어요. 잠시 뒤에 다시 시도해 주세요.',
    current: '현재 사용 중',
    lastUsed: (when: string) => `마지막 접속: ${when}`,
    signOut: '로그아웃',
    noRecords: '아직 로그인 기록이 없어요.',
    unknownAddress: '주소를 알 수 없어요',
    working: '처리 중',
    more: '더 보기',
    withdrawn: '탈퇴했어요. 그동안 써 주셔서 고마워요.',
    title: '내 정보',
    account: '계정',
    name: '이름',
    email: '이메일',
    joined: '가입한 날',
    devices: '로그인한 기기',
    history: '로그인 기록',
    withdraw: '회원탈퇴',
    // 사용자가 정한 문구라 격식체 그대로 둬요.
    withdrawTitle: '정말 탈퇴할까요?',
    withdrawBody: '계속하면 계정에 대한 모든 정보가 유실되며, 이 작업은 되돌릴 수 없습니다.',
    withdrawConfirm: '탈퇴하기',
  },
  en: {
    loading: 'Loading.',
    unlinked: (name: string) => `Disconnected ${name}.`,
    social: 'Social sign-in',
    linked: 'Connected',
    unlink: 'Disconnect',
    link: 'Connect',
    unlinkTitle: (name: string) => `Disconnect ${name}?`,
    unlinkBody: (name: string) => `You won't be able to sign in to this account with ${name}. You can connect it again later.`,
    revokeFailed: "Couldn't sign out that device. Please try again in a moment.",
    current: 'This device',
    lastUsed: (when: string) => `Last active: ${when}`,
    signOut: 'Sign out',
    noRecords: 'No sign-in history yet.',
    unknownAddress: 'Unknown address',
    working: 'Working',
    more: 'Show more',
    withdrawn: 'Your account has been deleted. Thanks for using Lofy.',
    title: 'Account',
    account: 'Profile',
    name: 'Name',
    email: 'Email',
    joined: 'Joined',
    devices: 'Signed-in devices',
    history: 'Sign-in history',
    withdraw: 'Delete account',
    withdrawTitle: 'Delete your account?',
    withdrawBody: 'All information associated with your account will be permanently lost. This cannot be undone.',
    withdrawConfirm: 'Delete account',
  },
})

interface Props {
  onSignedOut: () => void
}

const quiet = 'h-8 shrink-0 rounded-full px-3 text-[13px] font-medium transition-colors'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 first:mt-4">
      <h2 className="text-[17px] font-semibold text-gray-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Message({ children }: { children: React.ReactNode }) {
  return <p className="border-y border-gray-100 py-6 text-center text-[14px] text-gray-400">{children}</p>
}

function SkeletonRows({ count, action }: { count: number; action?: boolean }) {
  const text = useMessages(TEXT)
  return (
    <ul className="divide-y divide-gray-100 border-y border-gray-100" aria-busy="true">
      <li className="sr-only">{text.loading}</li>
      {Array.from({ length: count }, (_, index) => (
        <li key={index} aria-hidden className="flex items-center justify-between gap-4 py-4">
          <div className="min-w-0 flex-1">
            <Bone className="h-4 w-36" />
            <Bone className="mt-2.5 h-3.5 w-48 max-w-full" />
          </div>
          <Bone className={action ? 'h-8 w-[72px] shrink-0' : 'h-3.5 w-24 shrink-0'} />
        </li>
      ))}
    </ul>
  )
}

/**
 * 내 정보의 소셜 로그인 묶음이에요. 내 계정에 연결된 GitHub와 카카오 계정을 보여줘요. 연결해 두면 그 계정으로도 로그인할 수 있어요.
 * 서버가 켜 둔 서비스만 보여주고, 하나도 없으면 묶음을 통째로 숨겨요.
 */
function Connections() {
  const text = useMessages(TEXT)
  const { me } = useAuth()
  const clients = useSocialClients()
  const providers = (['github', 'kakao'] as const).filter((provider) => clients?.[provider])
  /** 앱에서는 연결이 브라우저에서 마무리돼요. 그 API가 없는 예전 서버에서는 앱에 연결 버튼을 두지 않아요. */
  const [appLink, setAppLink] = useState(false)
  /** 서버에 연결 해제 API가 있는지 */
  const [unlinkReady, setUnlinkReady] = useState(false)
  /** 해제할지 물어보고 있는 서비스 */
  const [unlinking, setUnlinking] = useState<SocialProvider | null>(null)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    void loadConfig().then((config) => {
      setAppLink(config.socialAppLink)
      setUnlinkReady(config.socialUnlink)
    })
    if (!isApp) return
    // 브라우저에서 연결을 마치고 앱으로 돌아오면 바로 보이게, 창에 다시 들어올 때 내 정보를 새로 받아요.
    const refresh = () => void loadMe()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])

  if (providers.length === 0) return null
  const canLink = !isApp || appLink
  // 로그인할 방법이 하나는 남아야 해요. 비밀번호가 없는 계정(소셜 로그인으로 가입)은 다른 소셜 계정이 연결되어 있을 때만 해제할 수 있어요.
  const canUnlink = (provider: SocialProvider) =>
    unlinkReady && (me?.passwordSet !== false || (provider === 'github' ? me?.kakao === true : me?.github === true))

  async function unlink(provider: SocialProvider) {
    setWorking(true)
    const outcome = await unlinkSocial(provider)
    track('auth_social_unlink', { provider, success: outcome.ok })
    setWorking(false)
    setUnlinking(null)
    showToast(outcome.ok ? pick(TEXT).unlinked(SOCIAL_LABELS[provider]) : outcome.message)
  }

  const linked = (provider: SocialProvider) => (provider === 'github' ? me?.github === true : me?.kakao === true)

  return (
    <Section title={text.social}>
      <ul className="divide-y divide-gray-100 border-y border-gray-100">
        {providers.map((provider) => (
          <li key={provider} className="flex items-center justify-between gap-4 py-3.5 text-[14px]">
            <div className="min-w-0">
              <p className="font-medium text-gray-900">{SOCIAL_LABELS[provider]}</p>
              {me && linked(provider) && provider === 'github' && me.githubLogin && <p className="mt-0.5 truncate text-[13px] text-gray-500">{me.githubLogin}</p>}
            </div>
            {me && linked(provider) && (
              <p className="flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-gray-600">
                <CheckIcon className="size-3.5 text-brand" />
                {text.linked}
                {canUnlink(provider) && (
                  <button type="button" onClick={() => setUnlinking(provider)} className={`${quiet} ml-1.5 bg-gray-100 text-gray-700 hover:text-red-500`}>
                    {text.unlink}
                  </button>
                )}
              </p>
            )}
            {me && !linked(provider) && canLink && (
              <div className="w-20 shrink-0 [&_button]:h-9 [&_button]:text-[13px]">
                <SocialButtons mode="link" returnTo="/me" only={provider} label={() => text.link} />
              </div>
            )}
          </li>
        ))}
      </ul>
      {unlinking && (
        <ConfirmDialog
          title={text.unlinkTitle(SOCIAL_LABELS[unlinking])}
          body={text.unlinkBody(SOCIAL_LABELS[unlinking])}
          confirm={text.unlink}
          danger
          working={working}
          onCancel={() => setUnlinking(null)}
          onConfirm={() => void unlink(unlinking)}
        />
      )}
    </Section>
  )
}

function Sessions() {
  const text = useMessages(TEXT)
  const [sessions, setSessions] = useState<DeviceSession[] | null>(null)
  const [error, setError] = useState('')
  const [revoking, setRevoking] = useState<string | null>(null)

  const load = useCallback(async () => {
    const result = await fetchSessions()
    if (result.ok) setSessions(result.data)
    else setError(result.message)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function revoke(sessionId: string) {
    setRevoking(sessionId)
    const ok = await revokeSession(sessionId)
    track('session_revoke', { success: ok })
    setRevoking(null)
    if (ok) setSessions((prev) => prev?.filter((session) => session.sessionId !== sessionId) ?? null)
    else setError(pick(TEXT).revokeFailed)
  }

  if (!sessions) return error ? <Message>{error}</Message> : <SkeletonRows count={2} action />

  return (
    <>
      <ul className="divide-y divide-gray-100 border-y border-gray-100">
        {sessions.map((session) => (
          <li key={session.sessionId} className="flex items-center justify-between gap-4 py-4">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium text-gray-900">
                {session.deviceName || describeDevice(session.userAgent)}
              </p>
              <p className="mt-1 text-[13px] text-gray-500">
                {session.current ? text.current : text.lastUsed(formatDateTime(session.lastUsedAt))}
              </p>
            </div>
            {!session.current && (
              <button
                type="button"
                disabled={revoking === session.sessionId}
                onClick={() => void revoke(session.sessionId)}
                className={`${quiet} bg-gray-100 text-gray-700 hover:text-red-500 disabled:text-gray-400`}
              >
                {text.signOut}
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="mt-3 text-[13px] text-red-500">{error}</p>}
    </>
  )
}

/** 로그인 기록은 처음에 이만큼만 보여주고, 더 보기를 누를 때마다 이만큼씩 더 보여줘요. */
const HISTORY_STEP = 5

function LoginHistory() {
  const text = useMessages(TEXT)
  const [records, setRecords] = useState<LoginRecord[]>([])
  /** 받아 둔 기록 중에 몇 개까지 보여줄지 */
  const [shown, setShown] = useState(HISTORY_STEP)
  const [page, setPage] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (next: number) => {
    setLoading(true)
    const result = await fetchLoginHistory(next)
    setLoading(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setError('')
    setRecords((prev) => (next === 0 ? result.data.items : [...prev, ...result.data.items]))
    setPage(next)
    setHasNext(result.data.hasNext)
  }, [])

  useEffect(() => {
    void load(0)
  }, [load])

  if (records.length === 0) {
    return loading ? <SkeletonRows count={4} /> : <Message>{error || text.noRecords}</Message>
  }

  return (
    <>
      <ul className="divide-y divide-gray-100 border-y border-gray-100">
        {records.slice(0, shown).map((record) => (
          <li key={record.id} className="flex items-start justify-between gap-4 py-4">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium text-gray-900">
                {record.deviceName || describeDevice(record.userAgent)}
              </p>
              <p className="mt-1 text-[13px] text-gray-500">
                {record.ipAddress ? <IpPlace ip={record.ipAddress} /> : record.current ? null : text.unknownAddress}
                {record.current && (record.ipAddress ? `, ${text.current}` : text.current)}
              </p>
            </div>
            <span className="shrink-0 pt-0.5 text-[13px] text-gray-400">{formatDateTime(record.loggedInAt)}</span>
          </li>
        ))}
      </ul>
      {error && <p className="mt-3 text-[13px] text-red-500">{error}</p>}
      {(hasNext || shown < records.length) && (
        <div className="mt-4 text-center">
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              // 받아 둔 기록을 먼저 더 보여주고, 모자라면 서버에서 다음 묶음을 받아요.
              const next = shown + HISTORY_STEP
              setShown(next)
              if (next > records.length && hasNext) void load(page + 1)
            }}
            className={`${quiet} bg-gray-100 text-gray-700 hover:text-brand disabled:text-gray-400`}
          >
            {loading ? text.working : text.more}
          </button>
        </div>
      )}
    </>
  )
}

export function MyPage({ onSignedOut }: Props) {
  const text = useMessages(TEXT)
  const { me } = useAuth()
  const [leaving, setLeaving] = useState(false)
  /** 서버에 회원 탈퇴 API가 있는지 */
  const [withdrawReady, setWithdrawReady] = useState(false)
  /** 탈퇴할지 물어보고 있는지 */
  const [askingWithdraw, setAskingWithdraw] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)

  useEffect(() => {
    void loadMe()
    void loadConfig().then((config) => setWithdrawReady(config.withdraw))
  }, [])

  async function handleWithdraw() {
    setWithdrawing(true)
    const outcome = await withdraw()
    track('auth_withdraw', { success: outcome.ok })
    setWithdrawing(false)
    setAskingWithdraw(false)
    if (!outcome.ok) {
      showToast(outcome.message)
      return
    }
    showToast(pick(TEXT).withdrawn)
    onSignedOut()
  }

  async function handleSignOut() {
    setLeaving(true)
    await signOut()
    track('auth_logout')
    onSignedOut()
  }

  const registered = parseServerTime(me?.registeredAt)

  return (
    <main className={pageFrame}>
      <PageHeader title={text.title} />
      <div className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6 pb-20 md:-mx-10 md:px-10">
      <div className="w-full max-w-2xl">

        <Section title={text.account}>
          <dl className="divide-y divide-gray-100 border-y border-gray-100 text-[14px]">
            {[
              { label: text.name, value: me?.name },
              { label: text.email, value: me?.email },
              { label: text.joined, value: registered ? formatDate(registered) : undefined },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 py-3.5">
                <dt className="shrink-0 text-gray-500">{row.label}</dt>
                <dd className="min-w-0 truncate text-right font-medium text-gray-900">
                  {me ? (row.value ?? '') : <Bone className="h-4 w-28" />}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-4">
            <button
              type="button"
              disabled={leaving}
              onClick={() => void handleSignOut()}
              className={`${quiet} bg-gray-100 text-gray-700 hover:text-gray-900 disabled:text-gray-400`}
            >
              {text.signOut}
            </button>
          </div>
        </Section>

        <Connections />

        <Section title={text.devices}>
          <Sessions />
        </Section>

        <Section title={text.history}>
          <LoginHistory />
        </Section>

        {/* 회원탈퇴는 눈에 띄지 않게, 맨 아래 오른쪽에 작은 글자로만 둬요. */}
        {withdrawReady && (
          <div className="mt-10 text-right">
            <button type="button" onClick={() => setAskingWithdraw(true)} className="text-[13px] text-red-500 transition-colors hover:text-red-600">
              {text.withdraw}
            </button>
          </div>
        )}
        {askingWithdraw && (
          <ConfirmDialog
            title={text.withdrawTitle}
            body={text.withdrawBody}
            confirm={text.withdrawConfirm}
            danger
            working={withdrawing}
            onCancel={() => setAskingWithdraw(false)}
            onConfirm={() => void handleWithdraw()}
          />
        )}
      </div>
      </div>
    </main>
  )
}
