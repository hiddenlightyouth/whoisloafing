import { track } from '../lib/analytics'
import { MAC_DOWNLOAD, MAC_DOWNLOAD_OPEN, MAC_SUPPORT } from '../lib/app'
import { messages, useMessages } from '../lib/i18n'
import { APP_NUDGE_TEXT } from './AppNudge'
import { AppleLogo } from './Header'
import { CheckIcon } from './Icons'

/** 웹에서는 못 쓰고 앱에서만 쓰는 화면 */
export type AppOnlyFeature = 'deep' | 'portfolio' | 'resume'

const TEXT = messages({
  ko: {
    title: '잠시만요!',
    body: {
      deep: '심층 분석을 사용하려면 macOS 앱에서 계속하세요.',
      portfolio: '포트폴리오 만들기를 사용하려면 macOS 앱에서 계속하세요.',
      resume: '이력서 만들기를 사용하려면 macOS 앱에서 계속하세요.',
    } as Record<AppOnlyFeature, string>,
    download: 'macOS 앱 다운로드',
    soon: 'macOS 앱은 곧 받을 수 있어요.',
  },
  en: {
    title: 'Hold on!',
    body: {
      deep: 'To use deep dive, continue in the macOS app.',
      portfolio: 'To build a portfolio, continue in the macOS app.',
      resume: 'To build a resume, continue in the macOS app.',
    },
    download: 'Download for macOS',
    soon: 'The macOS app is coming soon.',
  },
})

/** 웹의 /app에서 앱 전용 화면(심층 분석, 포트폴리오 만들기, 이력서 만들기)을 열면 대신 보여주는 안내예요. 앱에서 할 수 있는 일과 앱을 받는 버튼이 있어요. */
export function DeepAppOnly({ feature }: { feature: AppOnlyFeature }) {
  const text = useMessages(TEXT)
  const features = useMessages(APP_NUDGE_TEXT).FEATURES

  return (
    <main className="flex flex-1 items-center justify-center overflow-y-auto px-6 pt-14 pb-10">
      <div className="w-full max-w-sm animate-rise">
        <h1 className="text-balance break-keep text-[22px] font-semibold leading-snug text-gray-900 sm:text-[24px]">{text.title}</h1>
        <p className="mt-2.5 break-keep text-[14px] leading-relaxed text-gray-500">{text.body[feature]}</p>
        <ul className="mt-6 space-y-2">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-[14px] text-gray-700">
              <CheckIcon className="size-3.5 shrink-0 text-brand" />
              {feature}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap items-center gap-2.5">
          {MAC_DOWNLOAD_OPEN && (
            <a
              href={MAC_DOWNLOAD}
              download
              onClick={() => track('app_download_click', { os: 'macos', from: feature })}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              <AppleLogo />
              {text.download}
            </a>
          )}
        </div>
        <p className="mt-3 text-[12.5px] text-gray-400">{MAC_DOWNLOAD_OPEN ? MAC_SUPPORT : text.soon}</p>
      </div>
    </main>
  )
}
