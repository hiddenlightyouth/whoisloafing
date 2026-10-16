import { lazy, Suspense, useCallback, useEffect, useState, type ComponentProps, type ReactNode } from 'react'
import { useDismiss } from '../hooks/useDismiss'
import { track } from '../lib/analytics'
import { isWebApp } from '../lib/app'
import { messages, useMessages } from '../lib/i18n'
import { readFlag, writeFlag } from '../lib/storage'

// 앱에서만 쓰는 화면은 필요할 때만 받아요.
const AppGate = lazy(() => import('./AppGate').then((module) => ({ default: module.AppGate })))
const AppSidebar = lazy(() => import('./AppSidebar').then((module) => ({ default: module.AppSidebar })))

// 화면 공유 중에 화면을 가리는 막은 앱에서만 써요.
const CaptureShield = lazy(() => import('./CaptureShield').then((module) => ({ default: module.CaptureShield })))

// 설정 창은 앱에서만 쓰여서, 열 때만 받아요.
const Settings = lazy(() => import('./Settings').then((module) => ({ default: module.Settings })))

const SIDEBAR_CLOSED_KEY = 'whoisloafing:app-sidebar-closed'

const TEXT = messages({
  ko: {
    closeSidebar: '사이드바 닫기',
    openSidebar: '사이드바 열기',
  },
  en: {
    closeSidebar: 'Close sidebar',
    openSidebar: 'Open sidebar',
  },
})

/** 웹의 /app에서 사이드바를 서랍으로 꺼내는 좁은 화면(768px 미만)인지 */
const NARROW = '(max-width: 767px)'

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => isWebApp && window.matchMedia(NARROW).matches)
  useEffect(() => {
    if (!isWebApp) return
    const query = window.matchMedia(NARROW)
    const onChange = () => setNarrow(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return narrow
}

/** 앱의 사이드바를 펴 뒀는지와 접고 펴는 함수. 다음에 켰을 때도 그대로 둬요. */
export function useSidebarOpen() {
  const [open, setOpen] = useState(() => !readFlag(SIDEBAR_CLOSED_KEY))
  const toggle = useCallback((next: boolean) => {
    setOpen(next)
    writeFlag(SIDEBAR_CLOSED_KEY, !next)
  }, [])
  return [open, toggle] as const
}

/** 앱에서 로그인하지 않았을 때 다른 화면 대신 보여주는 로그인 화면이에요. */
export function AppSignedOut() {
  return (
    <Suspense fallback={<div data-app-drag className="h-dvh bg-white" />}>
      <AppGate />
      <CaptureShield />
    </Suspense>
  )
}

interface Props {
  sidebarOpen: boolean
  onToggleSidebar: (open: boolean) => void
  sidebar: Omit<ComponentProps<typeof AppSidebar>, 'onSettings' | 'settingsOpen'>
  children: ReactNode
}

/**
 * 앱에서는 왼쪽에 사이드바를 두고, 오른쪽에 웹과 같은 화면을 보여줘요. 설정 창과 화면 공유 중 가리는 막도 여기서 띄워요.
 * 웹의 /app도 같은 배치예요. 좁은 화면에서는 사이드바를 숨겨 두고, 왼쪽 위 버튼을 누르면 서랍처럼 화면 위로 꺼내요.
 */
export function AppFrame({ sidebarOpen, onToggleSidebar, sidebar, children }: Props) {
  const text = useMessages(TEXT)
  /** 앱의 설정 창이 떠 있는지. 보던 화면은 그대로 두고 그 위에 떠요. */
  const [settingsOpen, setSettingsOpen] = useState(false)
  const openSettings = useCallback(() => {
    track('settings_open')
    setSettingsOpen(true)
  }, [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  const narrow = useNarrow()
  /** 좁은 화면에서 서랍을 꺼내 뒀는지. 처음에는 넣어 둬요. */
  const [drawerOpen, setDrawerOpen] = useState(false)
  useDismiss(narrow && drawerOpen, null, () => setDrawerOpen(false))
  useEffect(() => {
    if (!narrow) setDrawerOpen(false)
  }, [narrow])
  const open = narrow ? drawerOpen : sidebarOpen
  const toggle = () => (narrow ? setDrawerOpen(!drawerOpen) : onToggleSidebar(!sidebarOpen))

  // 서랍에서 화면을 고르면 서랍을 닫고 그 화면을 보여줘요. 목록을 고치는 일(공유 취소, 지우기)과 설정 창은 서랍을 닫지 않아요.
  const closing = <T extends unknown[]>(action: ((...args: T) => void) | undefined) =>
    action && narrow
      ? (...args: T) => {
          setDrawerOpen(false)
          action(...args)
        }
      : action
  const panel = (
    <AppSidebar
      {...sidebar}
      onNew={closing(sidebar.onNew)!}
      onOpenChat={closing(sidebar.onOpenChat)!}
      onMe={closing(sidebar.onMe)!}
      onLogin={closing(sidebar.onLogin)}
      onDeep={closing(sidebar.onDeep)}
      onPortfolio={closing(sidebar.onPortfolio)}
      onResume={closing(sidebar.onResume)}
      onExplore={closing(sidebar.onExplore)}
      onDeepRepo={closing(sidebar.onDeepRepo)}
      onAdmin={closing(sidebar.onAdmin)}
      onSettings={openSettings}
      settingsOpen={settingsOpen}
    />
  )

  return (
    <div className="relative flex h-dvh bg-white">
      {/* 사이드바 접기 버튼은 늘 같은 자리에 있어서 접어도 펴도 움직이지 않아요. 앱에서는 창 버튼 바로 옆, 웹에서는 왼쪽 위예요. */}
      <button
        type="button"
        aria-label={open ? text.closeSidebar : text.openSidebar}
        aria-expanded={open}
        onClick={toggle}
        className={`absolute z-[31] flex size-7 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-200/70 hover:text-gray-900 ${isWebApp ? 'top-3.5 left-3' : 'top-0.5 left-[78px]'}`}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="size-4" aria-hidden="true">
          <rect x="2" y="3" width="12" height="10" rx="2.5" />
          <path d="M6.5 3v10" />
        </svg>
      </button>
      {open &&
        (narrow ? (
          <>
            <div aria-hidden onClick={() => setDrawerOpen(false)} className="fixed inset-0 z-30 animate-fade bg-gray-900/20" />
            <div className="fixed inset-y-0 left-0 z-30 flex animate-slide-in-left">
              <Suspense fallback={<aside className="w-64 border-r border-gray-200 bg-gray-50" />}>{panel}</Suspense>
            </div>
          </>
        ) : (
          <Suspense fallback={<aside data-app-drag className="w-64 shrink-0 border-r border-gray-200 bg-gray-50" />}>{panel}</Suspense>
        ))}
      {children}
      {settingsOpen && (
        <Suspense fallback={null}>
          <Settings onClose={closeSettings} />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <CaptureShield />
      </Suspense>
    </div>
  )
}
