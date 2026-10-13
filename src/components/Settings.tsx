import { useEffect, type ReactNode } from 'react'
import { track } from '../lib/analytics'
import { appAtLeast, appVersion, postToApp, type AppTheme } from '../lib/app'
import { setShortcutHintsPinned, useShortcutHintsPinned } from '../lib/shortcuts'
import { setAppBackdrop, setAppShield, setAppTheme, useAppSettings } from '../lib/theme'

const THEME_OPTIONS: [AppTheme, string][] = [
  ['system', '시스템 설정'],
  ['light', '라이트'],
  ['dark', '다크'],
]

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7 first:mt-0">
      <h3 className="text-[12.5px] font-medium text-gray-400">{title}</h3>
      <dl className="mt-2 divide-y divide-gray-100 border-y border-gray-100 text-[14px]">{children}</dl>
    </section>
  )
}

/** 설정 한 줄이에요. 왼쪽에 이름과 설명, 오른쪽에 고르는 칸이 있어요. */
function Row({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3.5">
      <dt className="min-w-0">
        <span className="block text-gray-900">{label}</span>
        {note && <span className="mt-0.5 block text-[12.5px] leading-relaxed break-keep text-gray-500">{note}</span>}
      </dt>
      <dd className="shrink-0">{children}</dd>
    </div>
  )
}

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`flex h-6 w-10 items-center rounded-full p-0.5 transition-colors ${on ? 'bg-brand' : 'bg-gray-200'}`}
    >
      {/* 손잡이는 다크 모드에서도 흰색이라 색 토큰을 쓰지 않아요. */}
      <span style={{ background: '#fff' }} className={`size-5 rounded-full transition-transform duration-200 ease-spring ${on ? 'translate-x-4' : ''}`} />
    </button>
  )
}

/**
 * 앱의 설정 창이에요. 보던 화면 위에 떠서, 앱이 어떻게 보이고 움직일지 정하는 것만 모아 둬요.
 * 이름, 이메일, 로그인한 기기처럼 계정에 딸린 것은 내 정보 화면에 있어요.
 * 바깥을 누르거나 Esc를 누르면 닫혀요. 바꾼 값은 바로 적용돼서 저장 버튼은 없어요.
 */
export function Settings({ onClose }: { onClose: () => void }) {
  const { theme, backdrop, shield } = useAppSettings()
  const hints = useShortcutHintsPinned()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 animate-fade z-40 flex items-center justify-center bg-gray-900/25 px-5 backdrop-blur-[2px]"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="settings-title" className="flex max-h-[85dvh] w-full max-w-lg animate-pop flex-col rounded-2xl border border-gray-200 bg-white">
        <div className="flex shrink-0 items-center justify-between px-6 pt-5 pb-4">
          <h2 id="settings-title" className="text-[17px] font-semibold text-gray-900">
            설정
          </h2>
          <button type="button" aria-label="닫기" onClick={onClose} className="-mr-2 flex size-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="size-4" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">

        <Section title="화면">
          <Row label="화면 모드">
            <div role="radiogroup" aria-label="화면 모드" className="inline-flex rounded-full bg-gray-100 p-1">
              {THEME_OPTIONS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={theme === value}
                  onClick={() => {
                    track('app_theme_change', { theme: value })
                    setAppTheme(value)
                  }}
                  className={`h-8 rounded-full px-3.5 text-[13px] font-medium transition-colors ${theme === value ? 'bg-white text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Row>
          <Row label="역동적인 시작 화면">
            <Switch
              on={backdrop}
              label="역동적인 시작 화면"
              onChange={(next) => {
                track('app_backdrop_change', { on: next })
                setAppBackdrop(next)
              }}
            />
          </Row>
          <Row label="단축키 항상 표시" note="단축키가 사용 가능한 메뉴에 어떤 단축키를 사용하는지 항상 표시합니다.">
            <Switch
              on={hints}
              label="단축키 항상 표시"
              onChange={(next) => {
                track('app_shortcut_hints_change', { on: next })
                setShortcutHintsPinned(next)
              }}
            />
          </Row>
        </Section>

        {/* 화면 공유를 알아채는 것은 앱 1.2부터라, 그보다 낮은 앱에서는 보여주지 않아요. */}
        {appAtLeast('1.2') && (
          <Section title="개인정보 보호">
            <Row label="화면 녹화 감지 시 가리기" note="macOS에서 화면 녹화가 감지되면 해제 시까지 화면을 가립니다.">
              <Switch
                on={shield}
                label="화면 녹화 감지 시 가리기"
                onChange={(next) => {
                  track('app_shield_change', { on: next })
                  setAppShield(next)
                }}
              />
            </Row>
          </Section>
        )}

        <Section title="앱">
          <Row label="버전">
            <span className="flex items-center gap-3">
              <span className="font-medium text-gray-900 tabular-nums">{appVersion}</span>
              {/* 예전 앱은 이 메시지를 받지 못해서, 받을 수 있는 버전에서만 버튼을 보여줘요. */}
              {appAtLeast('1.1') && (
                <button
                  type="button"
                  onClick={() => {
                    track('app_update_check')
                    postToApp({ type: 'update' })
                  }}
                  className="h-8 rounded-full bg-gray-100 px-3.5 text-[13px] font-medium text-gray-700 transition-colors hover:text-brand"
                >
                  업데이트 확인
                </button>
              )}
            </span>
          </Row>
        </Section>
        </div>
      </div>
    </div>
  )
}
