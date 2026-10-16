import { useEffect, useState } from 'react'
import { useShortcutHints } from '../lib/shortcuts'
import { messages, useMessages } from '../lib/i18n'

const TEXT = messages({ ko: { tip: '을 눌러 단축키 표시' }, en: { tip: 'Hold to show shortcuts' } })

interface KbdProps {
  children: string
  /** 버튼의 오른쪽 위 모서리에 얹어서 보여줘요. 버튼의 크기가 바뀌지 않아요. 버튼에 `relative`가 있어야 해요. */
  corner?: boolean
}

/**
 * 단축키의 키 하나를 자판 모양으로 보여줘요. 평소에는 숨겨 두고, Option을 누르고 있는 동안이나 설정에서 단축키 힌트 표시를 켜 뒀을 때만 보여요.
 * 줄 안에 넣은 것은 자리를 미리 차지하고 있어서, 나타나도 옆의 글자가 밀리지 않아요.
 */
export function Kbd({ children, corner = false }: KbdProps) {
  const shown = useShortcutHints()
  if (corner && !shown) return null
  return (
    <kbd
      aria-hidden={!shown}
      className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-[5px] border border-gray-200 bg-white px-1 font-sans text-[11px] leading-none font-medium text-gray-500 ${
        corner ? 'absolute -top-1.5 -right-1.5 z-10' : ''
      } ${shown ? '' : 'invisible'}`}
    >
      {children}
    </kbd>
  )
}

/** 안내를 이만큼 보여준 뒤에 알아서 사라져요. */
const TIP_MS = 6000

/**
 * 앱을 켰을 때 오른쪽 아래 구석에 잠깐 뜨는 안내예요. 다크 모드에서도 같은 검은 바탕이라 색 토큰을 쓰지 않아요. Option을 누르면 단축키가 보인다는 것을 알려줘요.
 * 몇 초 뒤에 사라지고, Option을 눌러 보면 바로 사라져요. 앱을 열거나 새로 고칠 때마다 다시 떠요. 단축키 힌트 표시를 켜 둔 사람에게는 띄우지 않아요.
 */
export function ShortcutTip() {
  const hinting = useShortcutHints()
  const [shown, setShown] = useState(true)
  const text = useMessages(TEXT)

  useEffect(() => {
    if (!shown) return
    const timer = window.setTimeout(() => setShown(false), TIP_MS)
    return () => window.clearTimeout(timer)
  }, [shown])

  useEffect(() => {
    if (hinting) setShown(false)
  }, [hinting])

  if (!shown || hinting) return null
  return (
    <p
      role="status"
      className="pointer-events-none fixed right-3 bottom-3 z-40 flex origin-bottom-right animate-pop items-center gap-1.5 rounded-md bg-black/90 px-2 py-1 text-[11.5px] font-medium text-white"
      style={{ animationDelay: '800ms' }}
    >
      {/* Mac 자판의 Option 키에 그려진 기호예요. */}
      <span className="rounded-[4px] border border-white/30 px-1 py-px text-[10.5px] leading-none">⌥ option</span>
      {text.tip}
    </p>
  )
}
