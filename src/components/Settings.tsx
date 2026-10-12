import { useEffect, type ReactNode } from 'react'
import { track } from '../lib/analytics'
import { appAtLeast, appVersion, postToApp, type AppTheme } from '../lib/app'
import { setShortcutHintsPinned, useShortcutHintsPinned } from '../lib/shortcuts'
import { setAppBackdrop, setAppShield, setAppTheme, useAppSettings } from '../lib/theme'

const SITE_TITLE = 'WhoIsLoafing'

const THEME_OPTIONS: [AppTheme, string][] = [
  ['system', '시스템 설정'],
  ['light', '라이트'],
  ['dark', '다크'],
]

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-[17px] font-semibold text-gray-900">{title}</h2>
      <dl className="mt-4 divide-y divide-gray-100 border-y border-gray-100 text-[14px]">{children}</dl>
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
      <span style={{ background: '#fff' }} className={`size-5 rounded-full transition-transform ${on ? 'translate-x-4' : ''}`} />
    </button>
  )
}

/**
 * 앱의 설정 화면이에요. 앱이 어떻게 보이고 움직일지 정하는 것만 모아 둬요.
 * 이름, 이메일, 로그인한 기기처럼 계정에 딸린 것은 내 정보 화면에 있어요.
 */
export function Settings() {
  const { theme, backdrop, shield } = useAppSettings()
  const hints = useShortcutHintsPinned()

  useEffect(() => {
    document.title = `설정 | ${SITE_TITLE}`
    return () => {
      document.title = SITE_TITLE
    }
  }, [])

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-5 pt-24 pb-20 sm:pt-28">
        <h1 className="text-[24px] font-semibold leading-snug text-gray-900 sm:text-[30px]">설정</h1>

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
          <Row label="지렁이 표시" note="새 분석 화면의 배경에 기여도 그래프와 지렁이를 보여줘요.">
            <Switch
              on={backdrop}
              label="새 분석 화면에서 지렁이 표시"
              onChange={(next) => {
                track('app_backdrop_change', { on: next })
                setAppBackdrop(next)
              }}
            />
          </Row>
          <Row label="단축키 힌트 표시" note="Option을 누르지 않아도 버튼 옆에 단축키를 늘 보여줘요.">
            <Switch
              on={hints}
              label="단축키 힌트 표시"
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
            <Row label="화면 공유 중 가리기" note="화면 공유나 녹화가 감지되면 화면을 가리고, 가림 해제를 눌러야 다시 보여줘요.">
              <Switch
                on={shield}
                label="화면 공유 중에는 화면 가리기"
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
    </main>
  )
}
