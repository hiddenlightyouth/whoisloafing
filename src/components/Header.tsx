import { useEffect, useState } from 'react'
import { track } from '../lib/analytics'
import { Logo } from './Logo'

interface Props {
  onHome: () => void
  /** 공유 버튼을 보여줄 수 있는 상태인지 (저장된 내 채팅이고 아직 공유하지 않음) */
  canShare: boolean
  /** 분석이 진행 중이면 공유를 잠깐 막아요. */
  busy: boolean
  shared: boolean
  onShare: () => Promise<boolean>
  onCopyLink: () => Promise<boolean>
}

const quiet = 'h-8 rounded-full px-3 text-[13px] font-medium transition-colors'

export function Header({ onHome, canShare, busy, shared, onShare, onCopyLink }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [working, setWorking] = useState(false)
  const [notice, setNotice] = useState('')

  // 안내 문구는 잠깐 보여줬다가 지워요.
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 2200)
    return () => clearTimeout(timer)
  }, [notice])

  async function share() {
    setWorking(true)
    const ok = await onShare()
    setWorking(false)
    setConfirming(false)
    setNotice(ok ? '공유했어요. 링크를 복사했어요.' : '공유하지 못했어요. 잠시 뒤에 다시 시도해 주세요.')
  }

  async function copy() {
    setNotice((await onCopyLink()) ? '링크를 복사했어요.' : '링크를 복사하지 못했어요.')
  }

  return (
    <header className="absolute inset-x-0 top-0 z-10 flex h-14 items-center justify-between bg-white/70 px-4 backdrop-blur-md sm:px-6">
      <Logo onClick={onHome} />

      <div className="relative flex items-center gap-2">
        {notice && (
          <span role="status" className="animate-rise text-xs text-gray-500">
            {notice}
          </span>
        )}

        {shared ? (
          <button type="button" onClick={copy} className={`${quiet} bg-brand-soft text-brand-hover hover:bg-brand hover:text-white`}>
            링크 복사
          </button>
        ) : (
          canShare && (
            <button
              type="button"
              disabled={busy}
              aria-expanded={confirming}
              onClick={() => {
                if (!confirming) track('share_open')
                setConfirming((open) => !open)
              }}
              className={`${quiet} bg-gray-100 text-gray-700 hover:text-brand disabled:text-gray-400`}
            >
              공유
            </button>
          )
        )}

        {confirming && !shared && (
          <div className="absolute top-full right-0 mt-2 w-64 animate-rise rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_12px_32px_-12px_rgba(16,24,40,0.25)]">
            <p className="text-[14px] font-semibold text-gray-900">이 채팅을 공유할까요?</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">
              링크를 아는 사람은 누구나 볼 수 있어요. 공유한 뒤에는 이 채팅에서 분석을 더 이어갈 수 없어요.
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
              <button
                type="button"
                disabled={working}
                onClick={share}
                className={`${quiet} bg-brand text-white hover:bg-brand-hover disabled:bg-gray-200 disabled:text-gray-400`}
              >
                공유하기
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
