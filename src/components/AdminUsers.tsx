import { useCallback, useEffect, useState } from 'react'
import { track } from '../lib/analytics'
import {
  changeUserPlan,
  changeUserRole,
  deleteUser,
  deviceLabels,
  fetchAdminUser,
  fetchAdminUsers,
  revokeUserSession,
  revokeUserSessions,
  suspendUser,
  unsuspendUser,
  type AdminUser,
  type AdminUserDetail,
  type AdminUserFilter,
  type Result,
} from '../lib/admin'
import { describeDevice, useAuth } from '../lib/auth'
import { formatDateTime, formatWhen } from '../lib/format'
import { showToast } from '../lib/toast'
import { tag, toolButton } from './DeepParts'
import { ConfirmDialog } from './Dialog'
import { DeviceTags, Empty, Failed, full, MoreButton, rowButton, RowsSkeleton, SearchBox, Segmented, tableWrap, td, th, useDebounced, usePaged } from './AdminParts'
import { IpPlace } from './IpPlace'
import { Bone } from './Skeleton'
import { messages, pick, useMessages } from '../lib/i18n'
import { CloseButton } from './Icons'


function StatusTags({ user, self }: { user: AdminUser; self: boolean }) {
  const L = useMessages(TEXT)
  return (
    <span className="flex flex-wrap gap-1">
      {user.role === 'ADMIN' && <span className={`${tag} text-brand-hover`}>{L.admin}</span>}
      {user.suspended && <span className={`${tag} text-red-500`}>{L.suspended}</span>}
      {self && <span className={tag}>{L.self}</span>}
    </span>
  )
}

/** 관리자 화면의 회원 탭이에요. 회원을 찾고, 어떤 기기로 쓰는지 보고, 눌러서 관리해요. */
export function AdminUsers({ onOpenChat }: { onOpenChat: (id: string) => void }) {
  const L = useMessages(TEXT)
  const { me } = useAuth()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<AdminUserFilter>('ALL')
  const keyword = useDebounced(query)
  const list = usePaged<AdminUser>((page) => fetchAdminUsers(keyword, filter, page), `${keyword}:${filter}`)
  const [openId, setOpenId] = useState<number | null>(null)
  const close = useCallback(() => setOpenId(null), [])

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={query} onChange={setQuery} placeholder={L.search} />
        <Segmented label={L.kind} options={L.filters} value={filter} onChange={setFilter} />
      </div>

      {list.items === null ? (
        list.error ? (
          <Failed message={list.error} onRetry={list.retry} />
        ) : (
          <RowsSkeleton />
        )
      ) : list.items.length === 0 ? (
        <Empty>{L.empty}</Empty>
      ) : (
        <>
          <div className={tableWrap}>
            <table className="w-full min-w-[760px] text-[13px] text-gray-700 tabular-nums">
              <thead>
                <tr>
                  <th className={th}>{L.member}</th>
                  <th className={th}>{L.status}</th>
                  <th className={th}>{L.devices}</th>
                  <th className={`${th} text-right`}>{L.chats}</th>
                  <th className={th}>{L.lastLogin}</th>
                  <th className={th}>{L.joined}</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((user) => (
                  <tr
                    key={user.id}
                    tabIndex={0}
                    aria-label={L.manage(user.name)}
                    onClick={() => {
                      track('admin_user_open')
                      setOpenId(user.id)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') setOpenId(user.id)
                    }}
                    className={`cursor-pointer border-t border-gray-100 transition-colors hover:bg-gray-50 ${openId === user.id ? 'bg-gray-50' : ''}`}
                  >
                    <td className={td}>
                      <p className="max-w-[220px] truncate font-semibold text-gray-900">{user.name}</p>
                      <p className="mt-0.5 max-w-[220px] truncate text-[12px] text-gray-400">{user.email}</p>
                    </td>
                    <td className={td}>
                      <StatusTags user={user} self={user.id === me?.id} />
                    </td>
                    <td className={td}>
                      <DeviceTags app={user.usesApp} mobile={user.usesMobile} desktop={user.usesDesktop} />
                    </td>
                    <td className={`${td} text-right`}>{full(user.chatCount)}</td>
                    <td className={`${td} whitespace-nowrap text-gray-500`}>{formatWhen(user.lastLoginAt) || L.none}</td>
                    <td className={`${td} whitespace-nowrap text-gray-500`}>{formatWhen(user.registeredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {list.hasNext && <MoreButton loading={list.loadingMore} onClick={() => void list.more()} />}
        </>
      )}

      {openId !== null && (
        <UserPanel
          key={openId}
          id={openId}
          selfId={me?.id ?? null}
          onClose={close}
          onChanged={list.refresh}
          onDeleted={() => {
            setOpenId(null)
            list.refresh()
          }}
          onOpenChat={onOpenChat}
        />
      )}
    </>
  )
}

type Action = 'promote' | 'demote' | 'suspend' | 'unsuspend' | 'logout' | 'delete'

interface ActionSpec {
  danger?: boolean
  run: (id: number) => Promise<Result<null>>
}

const ACTIONS: Record<Action, ActionSpec> = {
  promote: { run: (id) => changeUserRole(id, 'ADMIN') },
  demote: { run: (id) => changeUserRole(id, 'USER') },
  suspend: { danger: true, run: suspendUser },
  unsuspend: { run: unsuspendUser },
  logout: { run: revokeUserSessions },
  delete: { danger: true, run: deleteUser },
}

interface ActionText {
  title: string
  body: (name: string) => string
  confirm: string
  done: string
}

const TEXT = messages({
  ko: {
    filters: [['ALL', '전체'], ['APP', '앱'], ['MOBILE', '모바일'], ['DESKTOP', 'PC'], ['ADMIN', '관리자'], ['SUSPENDED', '정지']] as [AdminUserFilter, string][],
    admin: '관리자',
    suspended: '정지됨',
    self: '내 계정',
    search: '이메일이나 이름으로 찾기',
    kind: '회원 종류',
    empty: '조건에 맞는 회원이 없어요.',
    member: '회원',
    status: '상태',
    devices: '사용 기기',
    chats: '채팅',
    lastLogin: '마지막 로그인',
    joined: '가입',
    manage: (name: string) => `${name} 회원 관리`,
    none: '없음',
    unknown: '모름',
    actions: {
      promote: {
        title: '관리자로 올릴까요?',
        body: (name) => `${name} 님이 관리자 화면을 쓰고 다른 회원을 관리할 수 있게 돼요. 새 권한이 반영되게 이 회원의 모든 기기가 로그아웃돼요.`,
        confirm: '관리자로 올리기',
        done: '관리자로 올렸어요.',
      },
      demote: {
        title: '일반 회원으로 내릴까요?',
        body: (name) => `${name} 님이 더 이상 관리자 화면을 쓸 수 없어요. 이 회원의 모든 기기가 로그아웃돼요.`,
        confirm: '일반 회원으로 내리기',
        done: '일반 회원으로 내렸어요.',
      },
      suspend: {
        title: '이 회원을 정지할까요?',
        body: (name) => `${name} 님의 모든 기기가 로그아웃되고, 정지를 풀 때까지 다시 로그인할 수 없어요. 채팅과 기록은 그대로 남아요.`,
        confirm: '정지하기',
        done: '회원을 정지했어요.',
      },
      unsuspend: {
        title: '정지를 풀까요?',
        body: (name) => `${name} 님이 다시 로그인할 수 있게 돼요.`,
        confirm: '정지 풀기',
        done: '정지를 풀었어요.',
      },
      logout: {
        title: '모든 기기에서 로그아웃시킬까요?',
        body: (name) => `${name} 님이 로그인한 모든 기기가 로그아웃돼요. 다시 로그인하면 계속 쓸 수 있어요.`,
        confirm: '모두 로그아웃',
        done: '모든 기기를 로그아웃시켰어요.',
      },
      delete: {
        title: '이 회원을 지울까요?',
        body: (name) => `${name} 님의 계정과 로그인 기록, 분석한 채팅을 모두 지워요. 공유한 링크도 더 이상 열리지 않고, 지운 뒤에는 되돌릴 수 없어요.`,
        confirm: '회원 지우기',
        done: '회원을 지웠어요.',
      },
    } as Record<Action, ActionText>,
    deviceLoggedOut: '그 기기를 로그아웃시켰어요.',
    panel: '회원 관리',
    close: '닫기',
    loading: '불러오고 있어요.',
    registeredAt: '가입한 때',
    loginCount: '로그인한 횟수',
    times: (n: string) => `${n}번`,
    chatCount: '분석한 채팅',
    count: (n: string) => `${n}개`,
    app: '앱 사용',
    usedApp: '앱으로 로그인한 적이 있어요',
    noApp: '앱으로 로그인한 적이 없어요',
    suspendedAt: '정지한 때',
    planTitle: '요금제',
    plans: [['FREE', 'Free'], ['LITE', 'Lite'], ['PRO', 'Pro']] as ['FREE' | 'LITE' | 'PRO', string][],
    planChanged: (plan: string) => `요금제를 ${plan}로 바꿨어요.`,
    manageTitle: '관리',
    selfNote: '내 계정의 권한을 바꾸거나 정지, 삭제할 수는 없어요.',
    logoutAll: '모든 기기 로그아웃',
    sessions: '로그인한 기기',
    noSessions: '지금 로그인한 기기가 없어요.',
    lastUsed: (when: string) => `마지막 사용 ${when}`,
    logout: '로그아웃',
    logins: '최근 로그인',
    noLogins: '로그인한 기록이 없어요.',
    noIp: '주소를 알 수 없어요',
    recentChats: '최근 채팅',
    noChats: '분석한 채팅이 없어요.',
    chatMeta: (n: string, when: string) => `말풍선 ${n}개, ${when}`,
    open: '열기',
  },
  en: {
    filters: [['ALL', 'All'], ['APP', 'App'], ['MOBILE', 'Mobile'], ['DESKTOP', 'Desktop'], ['ADMIN', 'Admin'], ['SUSPENDED', 'Suspended']],
    admin: 'Admin',
    suspended: 'Suspended',
    self: 'You',
    search: 'Search by email or name',
    kind: 'Member type',
    empty: 'No members match.',
    member: 'Member',
    status: 'Status',
    devices: 'Devices',
    chats: 'Chats',
    lastLogin: 'Last sign-in',
    joined: 'Joined',
    manage: (name: string) => `Manage ${name}`,
    none: 'None',
    unknown: 'Unknown',
    actions: {
      promote: {
        title: 'Make this member an admin?',
        body: (name) => `${name} will be able to use the admin page and manage other members. All of their devices will be signed out so the new role applies.`,
        confirm: 'Make admin',
        done: 'Made them an admin.',
      },
      demote: {
        title: 'Change to a regular member?',
        body: (name) => `${name} will no longer be able to use the admin page. All of their devices will be signed out.`,
        confirm: 'Make regular member',
        done: 'Changed to a regular member.',
      },
      suspend: {
        title: 'Suspend this member?',
        body: (name) => `All of ${name}'s devices will be signed out, and they can't sign in until the suspension is lifted. Their chats and history stay.`,
        confirm: 'Suspend',
        done: 'Member suspended.',
      },
      unsuspend: {
        title: 'Lift the suspension?',
        body: (name) => `${name} will be able to sign in again.`,
        confirm: 'Lift suspension',
        done: 'Suspension lifted.',
      },
      logout: {
        title: 'Sign out of all devices?',
        body: (name) => `Every device ${name} is signed in on will be signed out. They can keep using it after signing in again.`,
        confirm: 'Sign out all',
        done: 'Signed out of all devices.',
      },
      delete: {
        title: 'Delete this member?',
        body: (name) => `${name}'s account, sign-in history, and analyzed chats will all be deleted. Shared links will stop working, and this can't be undone.`,
        confirm: 'Delete member',
        done: 'Member deleted.',
      },
    },
    deviceLoggedOut: 'Signed out that device.',
    panel: 'Manage member',
    close: 'Close',
    loading: 'Loading.',
    registeredAt: 'Joined',
    loginCount: 'Sign-ins',
    times: (n: string) => `${n}`,
    chatCount: 'Analyzed chats',
    count: (n: string) => `${n}`,
    app: 'App',
    usedApp: 'Has signed in with the app',
    noApp: 'Has never signed in with the app',
    suspendedAt: 'Suspended at',
    planTitle: 'Plan',
    plans: [['FREE', 'Free'], ['LITE', 'Lite'], ['PRO', 'Pro']] as ['FREE' | 'LITE' | 'PRO', string][],
    planChanged: (plan: string) => `Changed the plan to ${plan}.`,
    manageTitle: 'Manage',
    selfNote: "You can't change the role of, suspend, or delete your own account.",
    logoutAll: 'Sign out all devices',
    sessions: 'Signed-in devices',
    noSessions: 'No devices are signed in right now.',
    lastUsed: (when: string) => `Last used ${when}`,
    logout: 'Sign out',
    logins: 'Recent sign-ins',
    noLogins: 'No sign-in history.',
    noIp: 'Unknown address',
    recentChats: 'Recent chats',
    noChats: 'No analyzed chats.',
    chatMeta: (n: string, when: string) => `${n} messages, ${when}`,
    open: 'Open',
  },
})

const heading = 'mt-7 text-[12.5px] font-medium text-gray-400'

interface PanelProps {
  id: number
  selfId: number | null
  onClose: () => void
  /** 회원의 값이 바뀌었을 때 불러요. 목록을 조용히 다시 받아요. */
  onChanged: () => void
  onDeleted: () => void
  onOpenChat: (id: string) => void
}

/** 회원 한 명을 오른쪽에서 열어 보는 칸이에요. 로그인한 기기와 기록, 채팅을 보고 권한 변경, 정지, 로그아웃, 삭제를 해요. */
function UserPanel({ id, selfId, onClose, onChanged, onDeleted, onOpenChat }: PanelProps) {
  const L = useMessages(TEXT)
  const [detail, setDetail] = useState<AdminUserDetail | null>(null)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const [asking, setAsking] = useState<Action | null>(null)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    let stale = false
    void fetchAdminUser(id).then((result) => {
      if (stale) return
      if (result.ok) {
        setError('')
        setDetail(result.data)
      } else setError(result.message)
    })
    return () => {
      stale = true
    }
  }, [id, version])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const cancel = useCallback(() => setAsking(null), [])

  async function run(action: Action) {
    setWorking(true)
    const result = await ACTIONS[action].run(id)
    setWorking(false)
    track('admin_user_action', { action, success: result.ok })
    if (!result.ok) {
      showToast(result.message)
      return
    }
    setAsking(null)
    showToast(pick(TEXT).actions[action].done)
    if (action === 'delete') onDeleted()
    else {
      setVersion((value) => value + 1)
      onChanged()
    }
  }

  /** 요금제는 바로 바꿔요. 이번 주 한도에 곧바로 반영되고, 되돌리기도 쉬워서 한 번 더 묻지 않아요. */
  async function changePlan(plan: 'FREE' | 'LITE' | 'PRO') {
    const result = await changeUserPlan(id, plan)
    track('admin_user_action', { action: 'plan', plan, success: result.ok })
    showToast(result.ok ? pick(TEXT).planChanged(plan.charAt(0) + plan.slice(1).toLowerCase()) : result.message)
    if (!result.ok) return
    setVersion((value) => value + 1)
    onChanged()
  }

  async function logoutDevice(sessionId: string) {
    const result = await revokeUserSession(id, sessionId)
    track('admin_user_action', { action: 'logout_device', success: result.ok })
    showToast(result.ok ? pick(TEXT).deviceLoggedOut : result.message)
    setVersion((value) => value + 1)
  }

  const user = detail?.user
  const self = id === selfId

  return (
    <>
      <div className="fixed inset-0 z-20" onPointerDown={onClose} aria-hidden />
      <aside aria-label={L.panel} className="fixed inset-y-0 right-0 z-30 flex w-full max-w-[440px] animate-slide-in flex-col border-l border-gray-200 bg-white">
        <div className="flex h-14 shrink-0 items-center justify-end px-4">
          <CloseButton label={L.close} onClick={onClose} size="md" />
        </div>

        {!detail || !user ? (
          error ? (
            <Failed message={error} onRetry={() => setVersion((value) => value + 1)} />
          ) : (
            <div aria-busy="true" className="px-6">
              <span className="sr-only">{L.loading}</span>
              <Bone className="h-5 w-32" />
              <Bone className="mt-2.5 h-3.5 w-48" />
              <Bone className="mt-8 h-3 w-full" />
              <Bone className="mt-3 h-3 w-4/5" />
              <Bone className="mt-3 h-3 w-3/5" />
            </div>
          )
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8">
            <h2 className="truncate text-[20px] leading-tight font-semibold text-gray-900">{user.name}</h2>
            <p className="mt-1 truncate text-[13px] text-gray-500">{user.email}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              <StatusTags user={user} self={self} />
              <DeviceTags app={user.usesApp} mobile={user.usesMobile} desktop={user.usesDesktop} />
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
              {[
                [L.registeredAt, formatDateTime(user.registeredAt) || L.unknown],
                [L.lastLogin, formatDateTime(user.lastLoginAt) || L.none],
                [L.loginCount, L.times(full(user.loginCount))],
                [L.chatCount, L.count(full(user.chatCount))],
                [L.app, user.usesApp ? L.usedApp : L.noApp],
                ...(user.suspended ? [[L.suspendedAt, formatDateTime(user.suspendedAt)]] : []),
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[12px] text-gray-400">{label}</dt>
                  <dd className="mt-0.5 text-gray-900 tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>

            {user.plan && (
              <>
                <h3 className={heading}>{L.planTitle}</h3>
                <div className="mt-2">
                  <Segmented label={L.planTitle} options={L.plans} value={user.plan} onChange={(plan) => void changePlan(plan)} />
                </div>
              </>
            )}

            <h3 className={heading}>{L.manageTitle}</h3>
            {self ? (
              <p className="mt-2 text-[13px] leading-relaxed text-gray-500">{L.selfNote}</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => setAsking(user.role === 'ADMIN' ? 'demote' : 'promote')} className={toolButton}>
                  {user.role === 'ADMIN' ? L.actions.demote.confirm : L.actions.promote.confirm}
                </button>
                <button type="button" onClick={() => setAsking(user.suspended ? 'unsuspend' : 'suspend')} className={toolButton}>
                  {user.suspended ? L.actions.unsuspend.confirm : L.actions.suspend.confirm}
                </button>
                <button type="button" disabled={detail.sessions.length === 0} onClick={() => setAsking('logout')} className={`${toolButton} disabled:text-gray-300 disabled:hover:border-gray-200`}>
                  {L.logoutAll}
                </button>
                <button type="button" onClick={() => setAsking('delete')} className={`${toolButton} text-red-500 hover:text-red-600`}>
                  {L.actions.delete.confirm}
                </button>
              </div>
            )}

            <h3 className={heading}>{L.sessions}</h3>
            {detail.sessions.length === 0 ? (
              <p className="mt-2 text-[13px] text-gray-500">{L.noSessions}</p>
            ) : (
              <ul className="mt-1">
                {detail.sessions.map((session) => (
                  <li key={session.sessionId} className="flex items-center gap-3 border-b border-gray-100 py-2.5 last:border-b-0">
                    <span className={tag}>{deviceLabels()[session.device]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-gray-900">{session.deviceName || describeDevice(session.userAgent)}</span>
                      <span className="block text-[12px] text-gray-400">{L.lastUsed(formatDateTime(session.lastUsedAt))}</span>
                    </span>
                    {!self && (
                      <button type="button" onClick={() => void logoutDevice(session.sessionId)} className={rowButton}>
                        {L.logout}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <h3 className={heading}>{L.logins}</h3>
            {detail.logins.length === 0 ? (
              <p className="mt-2 text-[13px] text-gray-500">{L.noLogins}</p>
            ) : (
              <ul className="mt-1">
                {detail.logins.map((login) => (
                  <li key={login.id} className="flex items-center gap-3 border-b border-gray-100 py-2.5 last:border-b-0">
                    <span className={tag}>{deviceLabels()[login.device]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-gray-900">{login.deviceName || describeDevice(login.userAgent)}</span>
                      <span className="block truncate text-[12px] text-gray-400 tabular-nums">{login.ipAddress ? <IpPlace ip={login.ipAddress} /> : L.noIp}</span>
                    </span>
                    <span className="shrink-0 text-[12px] text-gray-400 tabular-nums">{formatDateTime(login.loggedInAt)}</span>
                  </li>
                ))}
              </ul>
            )}

            <h3 className={heading}>{L.recentChats}</h3>
            {detail.chats.length === 0 ? (
              <p className="mt-2 text-[13px] text-gray-500">{L.noChats}</p>
            ) : (
              <ul className="mt-1">
                {detail.chats.map((chat) => (
                  <li key={chat.id} className="flex items-center gap-3 border-b border-gray-100 py-2.5 last:border-b-0">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-gray-900">{chat.repoName}</span>
                      <span className="block text-[12px] text-gray-400 tabular-nums">
                        {L.chatMeta(full(chat.messageCount), formatDateTime(chat.updatedAt))}
                      </span>
                    </span>
                    {chat.shared && (
                      <button type="button" onClick={() => onOpenChat(chat.id)} className={rowButton}>
                        {L.open}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </aside>

      {asking && user && (
        <ConfirmDialog
          title={L.actions[asking].title}
          body={L.actions[asking].body(user.name)}
          confirm={L.actions[asking].confirm}
          danger={ACTIONS[asking].danger}
          working={working}
          onCancel={cancel}
          onConfirm={() => void run(asking)}
        />
      )}
    </>
  )
}
