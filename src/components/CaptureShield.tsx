import { useEffect, useState } from 'react'
import { track } from '../lib/analytics'
import { useAppCaptured } from '../lib/app'
import { useAppSettings } from '../lib/theme'
import { messages, useMessages } from '../lib/i18n'

const TEXT = messages({
  ko: { title: '화면 녹화가 감지 됨', body: '녹화가 감지되어 화면을 일시적으로 가렸어요.', note: '이 옵션은 설정에서 끄거나 켤 수 있습니다.', reveal: '가림 해제' },
  en: { title: 'Screen recording detected', body: 'The screen is hidden for now because recording was detected.', note: 'You can turn this on or off in Settings.', reveal: 'Show screen' },
})

/**
 * 앱에서 화면 공유나 녹화가 감지되면 화면 전체를 흐리게 가려요. 사용자가 가림 해제를 누르면 그 공유가 끝날 때까지 풀어 두고,
 * 공유가 끝났다가 다시 시작되면 다시 가려요. 화면을 한 장 찍는 캡처는 감지하지 않아요.
 * 계정 메뉴나 앱의 설정 창에서 끌 수 있어요.
 */
export function CaptureShield() {
  const { shield } = useAppSettings()
  /** 지금 화면이 공유되거나 녹화되고 있는지. 앱이 알려 줘요. */
  const active = useAppCaptured()
  /** 이번 공유에서는 계속 보겠다고 했는지 */
  const [allowed, setAllowed] = useState(false)
  const text = useMessages(TEXT)

  // 공유가 끝나면 동의를 지워서, 다음에 공유가 시작될 때 다시 물어봐요.
  useEffect(() => {
    if (!active) setAllowed(false)
  }, [active])

  const hidden = shield && active && !allowed
  useEffect(() => {
    if (hidden) track('capture_shield_view')
  }, [hidden])

  if (!hidden) return null
  return (
    // 가려 둔 동안에도 빈 곳을 잡으면 창을 옮길 수 있어요. 확인 창처럼 다뤄서 단축키는 받지 않아요.
    <div data-app-drag role="alertdialog" aria-modal="true" aria-labelledby="capture-shield-title" className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 px-6 backdrop-blur-2xl">
      <div className="w-full max-w-sm text-center">
        <h2 id="capture-shield-title" className="text-[20px] font-semibold text-gray-900">
          {text.title}
        </h2>
        <p className="mt-2.5 text-[14px] leading-relaxed break-keep text-gray-600">
          {text.body}
          <br />
          {text.note}
        </p>
        <button
          type="button"
          autoFocus
          onClick={() => {
            track('capture_shield_allow')
            setAllowed(true)
          }}
          className="mt-6 h-10 rounded-full bg-brand px-6 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover"
        >
          {text.reveal}
        </button>
      </div>
    </div>
  )
}
