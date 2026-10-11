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
                {[record.ipAddress, record.current ? '현재 사용 중' : null].filter(Boolean).join(', ') || '주소를 알 수 없어요'}
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
