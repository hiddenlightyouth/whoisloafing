import { useShortcutHints } from '../lib/shortcuts'

interface KbdProps {
  children: string
  className?: string
  /** 버튼의 오른쪽 위 모서리에 얹어서 보여줘요. 버튼의 크기가 바뀌지 않아요. 버튼에 `relative`가 있어야 해요. */
  corner?: boolean
}

/**
 * 단축키의 키 하나를 자판 모양으로 보여줘요. 평소에는 숨겨 두고, Option을 누르고 있는 동안이나 설정에서 단축키 힌트 표시를 켜 뒀을 때만 보여요.
 * 줄 안에 넣은 것은 자리를 미리 차지하고 있어서, 나타나도 옆의 글자가 밀리지 않아요.
 */
export function Kbd({ children, className = '', corner = false }: KbdProps) {
  const shown = useShortcutHints()
  if (corner && !shown) return null
  return (
    <kbd
      aria-hidden={!shown}
      className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-[5px] border border-gray-200 bg-white px-1 font-sans text-[11px] leading-none font-medium text-gray-500 ${
        corner ? 'absolute -top-1.5 -right-1.5 z-10' : ''
      } ${shown ? '' : 'invisible'} ${className}`}
    >
      {children}
    </kbd>
  )
}
