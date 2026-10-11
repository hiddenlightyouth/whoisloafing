import { useEffect, useRef, useState, type MouseEvent, type RefObject } from 'react'
import { track } from '../lib/analytics'
import { showToast } from '../lib/toast'
import type { AccountPage } from './Account'
import { Logo } from './Logo'

interface Props {
  onHome: () => void
  /** 내가 이어서 쓸 수 있는 채팅 화면인지. 이때만 공유와 중단하기 버튼을 보여줘요. */
  inChat: boolean
  /** 서버에 채팅 저장 기능이 켜져 있는지. 꺼져 있으면 공유할 수 없다고 안내해요. */
  storage: boolean
  /** 분석이 진행 중이면 공유 대신 중단하기 버튼을 보여줘요. */
  busy: boolean
  onStop: () => void
  shared: boolean
  onShare: () => Promise<boolean>
  onCopyLink: () => Promise<boolean>
  /** 로그인하지 않은 채로 공유하려고 할 때 로그인 화면으로 보내요. 로그인하면 이 채팅으로 돌아와요. */
  onLoginToShare: () => void
  /** 아티클 화면으로 가요. 진행 중인 채팅이 있을 때는 넘기지 않아서 링크가 보이지 않아요. */
  onArticles?: () => void
  signedIn?: boolean
  onAccount?: (page: AccountPage) => void
}

const quiet = 'h-8 rounded-full px-3 text-[13px] font-medium transition-colors'

export function Header({
  onHome,
  inChat,
  storage,
  busy,
  shared,
  onShare,
  onStop,
  onCopyLink,
  onLoginToShare,
  onArticles,
  signedIn = false,
  onAccount,
}: Props) {
  const [confirming, setConfirming] = useState(false)
  const [working, setWorking] = useState(false)
  const actionsRef = useRef<HTMLDivElement>(null)

  const [downloadOpen, setDownloadOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileDownloadOpen, setMobileDownloadOpen] = useState(false)
  const downloadRef = useRef<HTMLDivElement>(null)

  // 확인 창이나 드롭다운이 열려 있을 때 바깥을 누르거나 Esc를 누르면 닫아요.
  useDismiss(confirming, actionsRef, () => setConfirming(false))
  useDismiss(downloadOpen, downloadRef, () => setDownloadOpen(false))
  useDismiss(menuOpen, null, () => setMenuOpen(false))

  // 메뉴를 닫으면 펼쳐 둔 앱 다운로드도 접어요.
  useEffect(() => {
    if (!menuOpen) setMobileDownloadOpen(false)
  }, [menuOpen])

  async function share() {
    setWorking(true)
    const ok = await onShare()
    setWorking(false)
    setConfirming(false)
    if (!ok) showToast('공유하지 못했어요. 잠시 뒤에 다시 시도해 주세요.')
  }

  async function copy() {
    showToast((await onCopyLink()) ? '링크를 복사했어요.' : '링크를 복사하지 못했어요.')
  }

  const accountLinks = onAccount
    ? signedIn
      ? ([
          ['history', '내 작업'],
          ['me', '내 정보'],
        ] as const)
      : ([['login', '로그인']] as const)
    : []

  function goArticles(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    setMenuOpen(false)
    onArticles?.()
  }

  function goAccount(event: MouseEvent<HTMLAnchorElement>, page: AccountPage) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    setMenuOpen(false)
    track('account_nav_click', { page })
    onAccount?.(page)
  }

  function soon(item: string) {
    setDownloadOpen(false)
    track('nav_soon_click', { item })
    window.alert('곧 찾아옵니다.')
  }

  return (
    <>
      <header className="absolute inset-x-0 top-0 z-20 flex h-14 items-center justify-between bg-white/70 px-4 backdrop-blur-md sm:px-6">
        <Logo
          onClick={() => {
            setMenuOpen(false)
            setDownloadOpen(false)
            onHome()
          }}
        />

        <div ref={actionsRef} className="relative flex items-center gap-1 sm:gap-2">
          <nav className="hidden items-center gap-1 sm:flex sm:gap-2">
            <button type="button" onClick={() => soon('intro')} className={`${quiet} text-gray-600 hover:text-gray-900`}>
              소개
            </button>

            <div ref={downloadRef} className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={downloadOpen}
                onClick={() => setDownloadOpen((open) => !open)}
                className={`${quiet} inline-flex items-center gap-1 text-gray-600 hover:text-gray-900`}
              >
                앱 다운로드
                <Caret open={downloadOpen} />
              </button>
              {downloadOpen && (
                <div
                  role="menu"
                  className="absolute top-full left-1/2 mt-2 w-36 -translate-x-1/2 animate-rise rounded-2xl border border-gray-200 bg-white/80 p-1.5 backdrop-blur-xl"
                >
                  {DOWNLOADS.map(([os, label]) => (
                    <button
                      key={os}
                      type="button"
                      role="menuitem"
                      onClick={() => soon(os)}
                      className="block w-full rounded-xl px-3 py-2 text-left text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {onArticles && (
              <a href="/articles" onClick={goArticles} className={`${quiet} inline-flex items-center text-gray-600 hover:text-gray-900`}>
                아티클
              </a>
            )}

            {accountLinks.map(([page, label]) => (
              <a
                key={page}
                href={`/${page}`}
                onClick={(event) => goAccount(event, page)}
                className={`${quiet} inline-flex items-center text-gray-600 hover:text-gray-900`}
              >
                {label}
              </a>
            ))}
          </nav>

          {shared ? (
            <button type="button" onClick={copy} className={`${quiet} bg-brand-soft text-brand-hover hover:bg-brand hover:text-white`}>
              링크 복사
            </button>
          ) : (
            inChat &&
            (busy ? (
              <button type="button" onClick={onStop} className={`${quiet} bg-gray-100 text-gray-700 hover:text-red-500`}>
                중단하기
              </button>
            ) : (
              <button
                type="button"
                aria-expanded={confirming}
                onClick={() => {
                  if (!storage) {
                    showToast('저장 기능이 꺼져 있어서 공유할 수 없어요.')
                    return
                  }
                  if (!confirming) track('share_open', { signed_in: signedIn })
                  setConfirming((open) => !open)
                }}
                className={`${quiet} bg-gray-100 text-gray-700 hover:text-brand`}
              >
                공유하기
              </button>
            ))
          )}

          {confirming && !shared && !busy && (
            <div className="absolute top-full right-0 mt-2 w-64 animate-rise rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-[14px] font-semibold text-gray-900">{signedIn ? '이 채팅을 저장하고 공유할까요?' : '분석을 공유해 보세요'}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">
                {signedIn
                  ? '내 작업에 저장되고, 링크를 아는 사람은 누구나 볼 수 있어요. 공유하는 동안에는 분석을 더 이어갈 수 없고, 내 작업에서 언제든 공유를 취소할 수 있어요.'
                  : '로그인하면 이 채팅을 저장하고, 링크로 공유할 수 있는 기회가 주어져요.'}
              </p>
              <div className="mt-3.5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    track('share_cancel')
                    setConfirming(false)
                  }}
                  className={`${quiet} text-gray-600 hover:text-gray-900`}
                >
                  취소
                </button>
                {signedIn ? (
                  <button
                    type="button"
                    disabled={working}
                    onClick={share}
                    className={`${quiet} bg-brand text-white hover:bg-brand-hover disabled:bg-gray-200 disabled:text-gray-400`}
                  >
                    {working ? '처리 중' : '공유하기'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      track('share_login_click')
                      setConfirming(false)
                      setMenuOpen(false)
                      onLoginToShare()
                    }}
                    className={`${quiet} bg-brand text-white hover:bg-brand-hover`}
                  >
                    로그인하고 공유하기
                  </button>
                )}
              </div>
            </div>
          )}

          <button
            type="button"
            aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="relative ml-1 flex size-8 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-100 sm:hidden"
          >
            <span
              className={`absolute h-[1.5px] w-4 rounded-full bg-current transition-transform duration-200 ${menuOpen ? 'rotate-45' : '-translate-y-[5px]'}`}
            />
            <span className={`absolute h-[1.5px] w-4 rounded-full bg-current transition-opacity duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
            <span
              className={`absolute h-[1.5px] w-4 rounded-full bg-current transition-transform duration-200 ${menuOpen ? '-rotate-45' : 'translate-y-[5px]'}`}
            />
          </button>
        </div>
      </header>

      {menuOpen && (
        <div
          className="absolute inset-x-0 top-14 bottom-0 z-20 animate-rise bg-white/70 backdrop-blur-xl sm:hidden"
          onClick={(event) => {
            if (event.target === event.currentTarget) setMenuOpen(false)
          }}
        >
          <nav className="flex flex-col px-4 pt-2 pb-6">
            <button type="button" onClick={() => soon('intro')} className={mobileItem}>
              소개
            </button>

            <button
              type="button"
              aria-expanded={mobileDownloadOpen}
              onClick={() => setMobileDownloadOpen((open) => !open)}
              className={`${mobileItem} flex items-center justify-between`}
            >
              앱 다운로드
              <Caret open={mobileDownloadOpen} />
            </button>
            {mobileDownloadOpen && (
              <div className="animate-rise pb-2 pl-3">
                {DOWNLOADS.map(([os, label]) => (
                  <button
                    key={os}
                    type="button"
                    onClick={() => soon(os)}
                    className="block w-full py-2.5 text-left text-[15px] text-gray-600 transition-colors hover:text-gray-900"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {onArticles && (
              <a href="/articles" onClick={goArticles} className={mobileItem}>
                아티클
              </a>
            )}

            {accountLinks.map(([page, label]) => (
              <a key={page} href={`/${page}`} onClick={(event) => goAccount(event, page)} className={mobileItem}>
                {label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </>
  )
}

const DOWNLOADS = [
  ['macos', 'macOS'],
  ['windows', 'Windows'],
] as const

const mobileItem = 'block w-full border-b border-gray-200/70 py-3.5 text-left text-[16px] font-medium text-gray-800 transition-colors hover:text-gray-950'

function Caret({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 10 6"
      className={`h-1.5 w-2.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 1l4 4 4-4" />
    </svg>
  )
}

/** 열려 있는 동안 바깥을 누르거나 Esc를 누르면 닫아요. ref가 없으면 Esc만 받아요. */
function useDismiss(open: boolean, ref: RefObject<HTMLElement | null> | null, close: () => void) {
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (ref && !ref.current?.contains(event.target as Node)) close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
    // close는 매번 새로 만들어지지만 하는 일은 같아서 다시 등록하지 않아요.
  }, [open, ref])
}
