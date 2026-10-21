import { track } from '../lib/analytics'
import { isAdmin, useAuth } from '../lib/auth'
import { useShortcuts } from '../lib/shortcuts'
import { AdminChats } from './AdminChats'
import { AdminFeedback } from './AdminFeedback'
import { AdminOverview } from './AdminOverview'
import { AdminUsage } from './AdminUsage'
import { AdminUsers } from './AdminUsers'
import { pageFrame, PageHeader } from './AppPage'
import { Kbd } from './Shortcuts'
import { messages, useMessages } from '../lib/i18n'

export type AdminTab = 'overview' | 'users' | 'chats' | 'feedback' | 'ai'

const ADMIN_TABS: AdminTab[] = ['overview', 'users', 'chats', 'feedback', 'ai']

const TEXT = messages({
  ko: {
    tabs: { overview: '현황', users: '회원', chats: '채팅', feedback: '피드백', ai: 'AI 사용량' } as Record<AdminTab, string>,
    denied: '관리자 계정만 볼 수 있는 화면이에요.',
    title: '관리자',
  },
  en: {
    tabs: { overview: 'Overview', users: 'Members', chats: 'Chats', feedback: 'Feedback', ai: 'AI usage' },
    denied: 'Only admin accounts can see this page.',
    title: 'Admin',
  },
})

interface Props {
  tab: AdminTab
  onTab: (tab: AdminTab) => void
  /** 서버에 관리자 API가 있는지. 없으면 예전부터 있던 AI 사용량만 보여줘요. */
  full: boolean
  /** 서버가 피드백을 받는지. 없으면 피드백 탭을 숨겨요. */
  feedback: boolean
  /** 공유된 채팅을 열어요. */
  onOpenChat: (id: string) => void
}

/** 앱에서 관리자 계정만 보는 화면이에요. 서비스 현황, 회원, 채팅, AI 사용량을 탭으로 나눠서 봐요. */
export function Admin({ tab, onTab, full, feedback, onOpenChat }: Props) {
  const L = useMessages(TEXT)
  const { me } = useAuth()
  const allowed = me === null || isAdmin(me)
  const tabs = full ? ADMIN_TABS.filter((item) => feedback || item !== 'feedback') : (['ai'] as AdminTab[])
  const current = tabs.includes(tab) ? tab : tabs[0]

  const select = (next: AdminTab) => {
    if (next === current) return
    track('admin_tab_view', { tab: next })
    onTab(next)
  }

  useShortcuts(Object.fromEntries(tabs.map((item, index) => [`Digit${index + 1}`, () => select(item)])), allowed && tabs.length > 1)

  if (!allowed) {
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
        <p className="text-[14px] leading-relaxed text-gray-600">{L.denied}</p>
      </main>
    )
  }

  return (
    <main className={pageFrame}>
      <PageHeader title={L.title} />

      {tabs.length > 1 && (
        <div role="tablist" aria-label={L.title} className="flex shrink-0 gap-1 border-b border-gray-200">
          {tabs.map((item, index) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={item === current}
              onClick={() => select(item)}
              className={`relative -mb-px h-10 border-b-2 px-3 text-[13.5px] font-medium transition-colors ${
                item === current ? 'border-brand text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              {L.tabs[item]}
              <Kbd corner>{String(index + 1)}</Kbd>
            </button>
          ))}
        </div>
      )}

      <div role="tabpanel" className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6 pt-6 pb-10 md:-mx-10 md:px-10">
        {current === 'overview' ? (
          <AdminOverview />
        ) : current === 'users' ? (
          <AdminUsers onOpenChat={onOpenChat} />
        ) : current === 'chats' ? (
          <AdminChats onOpenChat={onOpenChat} />
        ) : current === 'feedback' ? (
          <AdminFeedback onOpenChat={onOpenChat} />
        ) : (
          <AdminUsage calls={full} />
        )}
      </div>
    </main>
  )
}
