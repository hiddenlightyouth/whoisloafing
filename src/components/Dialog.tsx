import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { messages, useMessages } from '../lib/i18n'

const TEXT = messages({
  ko: { cancel: '취소', working: '처리 중' },
  en: { cancel: 'Cancel', working: 'Working' },
})

export const quietButton = 'h-9 rounded-full px-3.5 text-[13px] font-medium text-gray-600 transition-colors hover:text-gray-900'
export const primaryButton =
  'h-9 rounded-full bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:bg-gray-200 disabled:text-gray-400'
const dangerButton =
  'h-9 rounded-full bg-red-500 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400'

/**
 * 화면을 흐리게 덮고 가운데에 뜨는 창이에요. 바깥을 누르거나 Esc를 누르면 닫혀요.
 * 화면 맨 바깥(body)에 그려요. 움직이는 요소 안에 두면 그 요소 크기만큼만 덮여서, 막과 블러가 화면 일부에만 깔려요.
 */
export function Modal({ onClose, labelledBy, alert = false, className = 'w-full max-w-sm p-5', children }: {
  onClose: () => void
  /** 창 제목의 id예요. 읽기 프로그램이 창 이름으로 읽어요. */
  labelledBy: string
  /** 되돌리기 어려운 작업을 묻는 창이면 켜요. */
  alert?: boolean
  className?: string
  children: ReactNode
}) {
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // 창 아래의 화면(맵, 칸)이 같은 Esc로 또 닫히지 않게 여기서 멈춰요.
      event.stopPropagation()
      close.current()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [])

  return createPortal(
    <div
      className="fixed inset-0 z-40 animate-fade flex items-center justify-center bg-gray-900/25 px-5 backdrop-blur-[2px]"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) close.current()
      }}
    >
      <div role={alert ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby={labelledBy} className={`animate-pop rounded-2xl border border-gray-200 bg-white ${className}`}>
        {children}
      </div>
    </div>,
    document.body,
  )
}

/** 되돌리기 어려운 작업을 하기 전에 한 번 더 묻는 창이에요. */
export function ConfirmDialog({ title, body, confirm, danger = false, working = false, onCancel, onConfirm }: {
  title: string
  body: ReactNode
  confirm: string
  danger?: boolean
  working?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const L = useMessages(TEXT)
  return (
    <Modal onClose={onCancel} labelledBy="confirm-dialog-title" alert>
      <h2 id="confirm-dialog-title" className="text-[15px] font-semibold text-gray-900">
        {title}
      </h2>
      <p className="mt-1.5 text-[13px] leading-relaxed break-keep text-gray-500 [overflow-wrap:anywhere]">{body}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={quietButton}>
          {L.cancel}
        </button>
        <button type="button" autoFocus disabled={working} onClick={onConfirm} className={danger ? dangerButton : primaryButton}>
          {working ? L.working : confirm}
        </button>
      </div>
    </Modal>
  )
}
