import { useCallback, useEffect, useState } from 'react'
import { track } from '../lib/analytics'
import {
  describeDevice,
  fetchLoginHistory,
  fetchSessions,
  loadMe,
  revokeSession,
  signOut,
  useAuth,
  type DeviceSession,
  type LoginRecord,
} from '../lib/auth'
import { formatDate, formatDateTime, parseServerTime } from '../lib/format'
import { loadConfig } from '../lib/api'
import { isApp } from '../lib/app'
import { SOCIAL_LABELS, type SocialProvider } from '../lib/social'
import { IpPlace } from './IpPlace'
import { SocialButtons, useSocialClients } from './Social'
import { Bone } from './Skeleton'

interface Props {
  onSignedOut: () => void
}

const quiet = 'h-8 shrink-0 rounded-full px-3 text-[13px] font-medium transition-colors'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-[17px] font-semibold text-gray-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Message({ children }: { children: React.ReactNode }) {
  return <p className="border-y border-gray-100 py-6 text-center text-[14px] text-gray-400">{children}</p>
}

function SkeletonRows({ count, action }: { count: number; action?: boolean }) {
  return (
    <ul className="divide-y divide-gray-100 border-y border-gray-100" aria-busy="true">
      <li className="sr-only">불러오고 있어요.</li>
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
  const { me } = useAuth()
  const clients = useSocialClients()
  const providers = (['github', 'kakao'] as const).filter((provider) => clients?.[provider])
  /** 앱에서는 연결이 브라우저에서 마무리돼요. 그 API가 없는 예전 서버에서는 앱에 연결 버튼을 두지 않아요. */
  const [appLink, setAppLink] = useState(false)

  useEffect(() => {
    if (!isApp) return
    void loadConfig().then((config) => setAppLink(config.socialAppLink))
    // 브라우저에서 연결을 마치고 앱으로 돌아오면 바로 보이게, 창에 다시 들어올 때 내 정보를 새로 받아요.
    const refresh = () => void loadMe()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])

  if (providers.length === 0) return null
  const canLink = !isApp || appLink

  const linked = (provider: SocialProvider) => (provider === 'github' ? me?.github === true : me?.kakao === true)

  return (
    <Section title="소셜 로그인">
      <ul className="divide-y divide-gray-100 border-y border-gray-100">
        {providers.map((provider) => (
          <li key={provider} className="flex items-center justify-between gap-4 py-3.5 text-[14px]">
            <div className="min-w-0">
              <p className="font-medium text-gray-900">{SOCIAL_LABELS[provider]}</p>
              {me && linked(provider) && provider === 'github' && me.githubLogin && <p className="mt-0.5 truncate text-[13px] text-gray-500">{me.githubLogin}</p>}
            </div>
            {me && linked(provider) && (
              <p className="flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-gray-600">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 text-brand" aria-hidden="true">
                  <path d="M3.5 8.5l3 3 6-7" />
                </svg>
                등록 됨
              </p>
            )}
            {me && !linked(provider) && canLink && (
              <div className="w-20 shrink-0 [&_button]:h-9 [&_button]:text-[13px]">
                <SocialButtons mode="link" returnTo="/me" only={provider} label={() => '연결'} />
              </div>
            )}
          </li>
        ))}
      </ul>
      {isApp && canLink && me && providers.some((provider) => !linked(provider)) && <p className="mt-3 text-[13px] text-gray-500">연결을 누르면 브라우저가 열려요. 거기서 마무리하면 돼요.</p>}
    </Section>
  )
}

function Sessions() {
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
    else setError('기기를 로그아웃시키지 못했어요. 잠시 뒤에 다시 시도해 주세요.')
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
                {session.current ? '현재 사용 중' : `마지막 접속: ${formatDateTime(session.lastUsedAt)}`}
              </p>
            </div>
            {!session.current && (
              <button
                type="button"
                disabled={revoking === session.sessionId}
                onClick={() => void revoke(session.sessionId)}
                className={`${quiet} bg-gray-100 text-gray-700 hover:text-red-500 disabled:text-gray-400`}
              >
                로그아웃
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="mt-3 text-[13px] text-red-500">{error}</p>}
    </>
  )
}

function LoginHistory() {
  const [records, setRecords] = useState<LoginRecord[]>([])
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
    return loading ? <SkeletonRows count={4} /> : <Message>{error || '아직 로그인 기록이 없어요.'}</Message>
  }

  return (
    <>
      <ul className="divide-y divide-gray-100 border-y border-gray-100">
        {records.map((record) => (
          <li key={record.id} className="flex items-start justify-between gap-4 py-4">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium text-gray-900">
                {record.deviceName || describeDevice(record.userAgent)}
              </p>
              <p className="mt-1 text-[13px] text-gray-500">
                {record.ipAddress ? <IpPlace ip={record.ipAddress} /> : record.current ? null : '주소를 알 수 없어요'}
                {record.current && (record.ipAddress ? ', 현재 사용 중' : '현재 사용 중')}
              </p>
            </div>
            <span className="shrink-0 pt-0.5 text-[13px] text-gray-400">{formatDateTime(record.loggedInAt)}</span>
          </li>
        ))}
      </ul>
      {error && <p className="mt-3 text-[13px] text-red-500">{error}</p>}
      {hasNext && (
        <div className="mt-4 text-center">
          <button
            type="button"
            disabled={loading}
            onClick={() => void load(page + 1)}
            className={`${quiet} bg-gray-100 text-gray-700 hover:text-brand disabled:text-gray-400`}
          >
            {loading ? '처리 중' : '더 보기'}
          </button>
        </div>
      )}
    </>
  )
}

export function MyPage({ onSignedOut }: Props) {
  const { me } = useAuth()
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    void loadMe()
  }, [])

  async function handleSignOut() {
    setLeaving(true)
    await signOut()
    track('auth_logout')
    onSignedOut()
  }

  const registered = parseServerTime(me?.registeredAt)

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-5 pt-24 pb-20 sm:pt-28">
        <h1 className="text-[24px] font-semibold leading-snug text-gray-900 sm:text-[30px]">내 정보</h1>

        <Section title="계정">
          <dl className="divide-y divide-gray-100 border-y border-gray-100 text-[14px]">
            {[
              { label: '이름', value: me?.name },
              { label: '이메일', value: me?.email },
              { label: '가입한 날', value: registered ? formatDate(registered) : undefined },
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
              로그아웃
            </button>
          </div>
        </Section>

        <Connections />

        <Section title="로그인한 기기">
          <Sessions />
        </Section>

        <Section title="로그인 기록">
          <LoginHistory />
        </Section>
      </div>
    </main>
  )
}
