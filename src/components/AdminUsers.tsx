import { useCallback, useEffect, useState } from 'react'
import { track } from '../lib/analytics'
import {
  changeUserRole,
  deleteUser,
  DEVICE_LABELS,
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
import { ConfirmDialog, DeviceTags, Empty, Failed, full, MoreButton, rowButton, RowsSkeleton, SearchBox, Segmented, tableWrap, td, th, useDebounced, usePaged } from './AdminParts'
import { IpPlace } from './IpPlace'
import { Bone } from './Skeleton'

const FILTERS: [AdminUserFilter, string][] = [
  ['ALL', '전체'],
  ['APP', '앱'],
  ['MOBILE', '모바일'],
  ['DESKTOP', 'PC'],
  ['ADMIN', '관리자'],
  ['SUSPENDED', '정지'],
]

function StatusTags({ user, self }: { user: AdminUser; self: boolean }) {
  return (
    <span className="flex flex-wrap gap-1">
      {user.role === 'ADMIN' && <span className={`${tag} text-brand-hover`}>관리자</span>}
      {user.suspended && <span className={`${tag} text-red-500`}>정지됨</span>}
      {self && <span className={tag}>내 계정</span>}
    </span>
  )
}

/** 관리자 화면의 회원 탭이에요. 회원을 찾고, 어떤 기기로 쓰는지 보고, 눌러서 관리해요. */
export function AdminUsers({ onOpenChat }: { onOpenChat: (id: string) => void }) {
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
        <SearchBox value={query} onChange={setQuery} placeholder="이메일이나 이름으로 찾기" />
        <Segmented label="회원 종류" options={FILTERS} value={filter} onChange={setFilter} />
      </div>

      {list.items === null ? (
        list.error ? (
          <Failed message={list.error} onRetry={list.retry} />
        ) : (
          <RowsSkeleton />
        )
      ) : list.items.length === 0 ? (
        <Empty>조건에 맞는 회원이 없어요.</Empty>
      ) : (
        <>
          <div className={tableWrap}>
            <table className="w-full min-w-[760px] text-[13px] text-gray-700 tabular-nums">
              <thead>
                <tr>
                  <th className={th}>회원</th>
                  <th className={th}>상태</th>
                  <th className={th}>사용 기기</th>
                  <th className={`${th} text-right`}>채팅</th>
                  <th className={th}>마지막 로그인</th>
                  <th className={th}>가입</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((user) => (
                  <tr
                    key={user.id}
                    tabIndex={0}
                    aria-label={`${user.name} 회원 관리`}
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
                    <td className={`${td} whitespace-nowrap text-gray-500`}>{formatWhen(user.lastLoginAt) || '없음'}</td>
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
  title: string
  body: (name: string) => string
  confirm: string
  danger?: boolean
  run: (id: number) => Promise<Result<null>>
  done: string
}

const ACTIONS: Record<Action, ActionSpec> = {
  promote: {
    title: '관리자로 올릴까요?',
    body: (name) => `${name} 님이 관리자 화면을 쓰고 다른 회원을 관리할 수 있게 돼요. 새 권한이 반영되게 이 회원의 모든 기기가 로그아웃돼요.`,
    confirm: '관리자로 올리기',
    run: (id) => changeUserRole(id, 'ADMIN'),
    done: '관리자로 올렸어요.',
  },
  demote: {
    title: '일반 회원으로 내릴까요?',
    body: (name) => `${name} 님이 더 이상 관리자 화면을 쓸 수 없어요. 이 회원의 모든 기기가 로그아웃돼요.`,
    confirm: '일반 회원으로 내리기',
    run: (id) => changeUserRole(id, 'USER'),
    done: '일반 회원으로 내렸어요.',
  },
  suspend: {
    title: '이 회원을 정지할까요?',
    body: (name) => `${name} 님의 모든 기기가 로그아웃되고, 정지를 풀 때까지 다시 로그인할 수 없어요. 채팅과 기록은 그대로 남아요.`,
    confirm: '정지하기',
    danger: true,
    run: suspendUser,
    done: '회원을 정지했어요.',
  },
  unsuspend: {
    title: '정지를 풀까요?',
    body: (name) => `${name} 님이 다시 로그인할 수 있게 돼요.`,
    confirm: '정지 풀기',
    run: unsuspendUser,
    done: '정지를 풀었어요.',
  },
  logout: {
    title: '모든 기기에서 로그아웃시킬까요?',
    body: (name) => `${name} 님이 로그인한 모든 기기가 로그아웃돼요. 다시 로그인하면 계속 쓸 수 있어요.`,
    confirm: '모두 로그아웃',
    run: revokeUserSessions,
    done: '모든 기기를 로그아웃시켰어요.',
  },
  delete: {
    title: '이 회원을 지울까요?',
    body: (name) => `${name} 님의 계정과 로그인 기록, 분석한 채팅을 모두 지워요. 공유한 링크도 더 이상 열리지 않고, 지운 뒤에는 되돌릴 수 없어요.`,
    confirm: '회원 지우기',
    danger: true,
    run: deleteUser,
    done: '회원을 지웠어요.',
  },
}

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
    showToast(ACTIONS[action].done)
    if (action === 'delete') onDeleted()
    else {
      setVersion((value) => value + 1)
      onChanged()
    }
  }

  async function logoutDevice(sessionId: string) {
    const result = await revokeUserSession(id, sessionId)
    track('admin_user_action', { action: 'logout_device', success: result.ok })
    showToast(result.ok ? '그 기기를 로그아웃시켰어요.' : result.message)
    setVersion((value) => value + 1)
  }

  const user = detail?.user
  const self = id === selfId

  return (
    <>
      <div className="fixed inset-0 z-20" onPointerDown={onClose} aria-hidden />
      <aside aria-label="회원 관리" className="fixed inset-y-0 right-0 z-30 flex w-full max-w-[440px] animate-slide-in flex-col border-l border-gray-200 bg-white">
        <div className="flex h-14 shrink-0 items-center justify-end px-4">
          <button type="button" aria-label="닫기" onClick={onClose} className="flex size-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="size-4" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {!detail || !user ? (
          error ? (
            <Failed message={error} onRetry={() => setVersion((value) => value + 1)} />
          ) : (
            <div aria-busy="true" className="px-6">
              <span className="sr-only">불러오고 있어요.</span>
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
                ['가입한 때', formatDateTime(user.registeredAt) || '모름'],
                ['마지막 로그인', formatDateTime(user.lastLoginAt) || '없음'],
                ['로그인한 횟수', `${full(user.loginCount)}번`],
                ['분석한 채팅', `${full(user.chatCount)}개`],
                ['앱 사용', user.usesApp ? '앱으로 로그인한 적이 있어요' : '앱으로 로그인한 적이 없어요'],
                ...(user.suspended ? [['정지한 때', formatDateTime(user.suspendedAt)]] : []),
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[12px] text-gray-400">{label}</dt>
                  <dd className="mt-0.5 text-gray-900 tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>

            <h3 className={heading}>관리</h3>
            {self ? (
              <p className="mt-2 text-[13px] leading-relaxed text-gray-500">내 계정의 권한을 바꾸거나 정지, 삭제할 수는 없어요.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => setAsking(user.role === 'ADMIN' ? 'demote' : 'promote')} className={toolButton}>
                  {user.role === 'ADMIN' ? '일반 회원으로 내리기' : '관리자로 올리기'}
                </button>
                <button type="button" onClick={() => setAsking(user.suspended ? 'unsuspend' : 'suspend')} className={toolButton}>
                  {user.suspended ? '정지 풀기' : '정지하기'}
                </button>
                <button type="button" disabled={detail.sessions.length === 0} onClick={() => setAsking('logout')} className={`${toolButton} disabled:text-gray-300 disabled:hover:border-gray-200`}>
                  모든 기기 로그아웃
                </button>
                <button type="button" onClick={() => setAsking('delete')} className={`${toolButton} text-red-500 hover:text-red-600`}>
                  회원 지우기
                </button>
              </div>
            )}

            <h3 className={heading}>로그인한 기기</h3>
            {detail.sessions.length === 0 ? (
              <p className="mt-2 text-[13px] text-gray-500">지금 로그인한 기기가 없어요.</p>
            ) : (
              <ul className="mt-1">
                {detail.sessions.map((session) => (
                  <li key={session.sessionId} className="flex items-center gap-3 border-b border-gray-100 py-2.5 last:border-b-0">
                    <span className={tag}>{DEVICE_LABELS[session.device]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-gray-900">{session.deviceName || describeDevice(session.userAgent)}</span>
                      <span className="block text-[12px] text-gray-400">마지막 사용 {formatDateTime(session.lastUsedAt)}</span>
                    </span>
                    {!self && (
                      <button type="button" onClick={() => void logoutDevice(session.sessionId)} className={rowButton}>
                        로그아웃
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <h3 className={heading}>최근 로그인</h3>
            {detail.logins.length === 0 ? (
              <p className="mt-2 text-[13px] text-gray-500">로그인한 기록이 없어요.</p>
            ) : (
              <ul className="mt-1">
                {detail.logins.map((login) => (
                  <li key={login.id} className="flex items-center gap-3 border-b border-gray-100 py-2.5 last:border-b-0">
                    <span className={tag}>{DEVICE_LABELS[login.device]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-gray-900">{login.deviceName || describeDevice(login.userAgent)}</span>
                      <span className="block truncate text-[12px] text-gray-400 tabular-nums">{login.ipAddress ? <IpPlace ip={login.ipAddress} /> : '주소를 알 수 없어요'}</span>
                    </span>
                    <span className="shrink-0 text-[12px] text-gray-400 tabular-nums">{formatDateTime(login.loggedInAt)}</span>
                  </li>
                ))}
              </ul>
            )}

            <h3 className={heading}>최근 채팅</h3>
            {detail.chats.length === 0 ? (
              <p className="mt-2 text-[13px] text-gray-500">분석한 채팅이 없어요.</p>
            ) : (
              <ul className="mt-1">
                {detail.chats.map((chat) => (
                  <li key={chat.id} className="flex items-center gap-3 border-b border-gray-100 py-2.5 last:border-b-0">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-gray-900">{chat.repoName}</span>
                      <span className="block text-[12px] text-gray-400 tabular-nums">
                        말풍선 {full(chat.messageCount)}개, {formatDateTime(chat.updatedAt)}
                      </span>
                    </span>
                    {chat.shared && (
                      <button type="button" onClick={() => onOpenChat(chat.id)} className={rowButton}>
                        열기
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
          title={ACTIONS[asking].title}
          body={ACTIONS[asking].body(user.name)}
          confirm={ACTIONS[asking].confirm}
          danger={ACTIONS[asking].danger}
          working={working}
          onCancel={cancel}
          onConfirm={() => void run(asking)}
        />
      )}
    </>
  )
}
