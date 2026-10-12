import { useEffect } from 'react'
import { isApp } from '../lib/app'
import { SHORTCUT_GROUPS, useShortcutHints } from '../lib/shortcuts'

interface KbdProps {
  children: string
  className?: string
  /** 안내 창처럼 Option을 누르지 않아도 늘 보여줄 때 true */
  always?: boolean
  /** 버튼의 오른쪽 위 모서리에 얹어서 보여줘요. 버튼의 크기가 바뀌지 않아요. 버튼에 `relative`가 있어야 해요. */
  corner?: boolean
}

/**
 * 단축키의 키 하나를 자판 모양으로 보여줘요. 평소에는 숨겨 두고, Option을 누르고 있는 동안이나 설정에서 단축키 힌트 표시를 켜 뒀을 때만 보여요.
 * 줄 안에 넣은 것은 자리를 미리 차지하고 있어서, 나타나도 옆의 글자가 밀리지 않아요.
 */
export function Kbd({ children, className = '', always = false, corner = false }: KbdProps) {
  const held = useShortcutHints()
  const shown = always || held
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

/** 쓸 수 있는 단축키를 모아 보여주는 창이에요. 물음표 키로 열고, 바깥을 누르거나 Esc를 누르면 닫혀요. */
export function ShortcutHelp({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const groups = SHORTCUT_GROUPS.filter((group) => isApp || !group.app)
    .map((group) => ({ ...group, items: group.items.filter((item) => isApp || !item.app) }))
    .filter((group) => group.items.length > 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/25 px-5 backdrop-blur-[2px]"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-help-title"
        className="relative max-h-[80dvh] w-full max-w-sm animate-rise overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5"
      >
        <button
          type="button"
          aria-label="닫기"
          autoFocus
          onClick={onClose}
          className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-3.5" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
          </svg>
        </button>
        <h2 id="shortcut-help-title" className="text-[15px] font-semibold text-gray-900">
          단축키
        </h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-gray-500">글자를 입력하는 중이 아닐 때, 키 하나만 누르면 돼요. Option을 누르고 있으면 화면의 버튼 옆에 키가 보여요. 계정 메뉴의 단축키 힌트 표시를 켜면 늘 보여요.</p>

        {groups.map((group) => (
          <section key={group.title} className="mt-5">
            <h3 className="text-[12px] font-medium text-gray-400">{group.title}</h3>
            <dl className="mt-1.5 divide-y divide-gray-100">
              {group.items.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-4 py-2">
                  <dt className="text-[13.5px] text-gray-800">{item.label}</dt>
                  <dd className="flex shrink-0 items-center gap-1">
                    {item.keys.map((key) => (
                      <Kbd key={key} always>
                        {key}
                      </Kbd>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  )
}
