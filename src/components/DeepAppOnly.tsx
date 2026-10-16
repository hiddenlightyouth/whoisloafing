import { track } from '../lib/analytics'
import { MAC_DOWNLOAD, MAC_DOWNLOAD_OPEN, MAC_SUPPORT } from '../lib/app'
import { messages, useMessages } from '../lib/i18n'
import { APP_NUDGE_TEXT } from './AppNudge'
import { AppleLogo } from './Header'

const TEXT = messages({
  ko: {
    title: '심층 분석은 macOS 앱에서 쓸 수 있어요',
    body: '레포 하나를 한 화면에 펼쳐 놓고 살펴보는 대시보드라, 넓은 화면의 앱에서만 열어 둬요.',
    download: 'macOS 앱 다운로드',
    soon: 'macOS 앱은 곧 받을 수 있어요.',
    back: '새 분석으로',
  },
  en: {
    title: 'Deep dive lives in the Mac app',
    body: 'It lays out a whole repo on one dashboard, so it is available in the macOS app only.',
    download: 'Download for macOS',
    soon: 'The macOS app is coming soon.',
    back: 'New analysis',
  },
})

/** 웹의 /app에서 심층 분석을 열면 대시보드 대신 보여주는 안내예요. 앱에서 할 수 있는 일과 앱을 받는 버튼이 있어요. */
export function DeepAppOnly({ onHome }: { onHome: () => void }) {
  const text = useMessages(TEXT)
  const features = useMessages(APP_NUDGE_TEXT).FEATURES

  return (
    <main className="flex flex-1 items-center justify-center overflow-y-auto px-6 pt-14 pb-10">
      <div className="w-full max-w-sm animate-rise">
        <h1 className="text-balance break-keep text-[22px] font-semibold leading-snug text-gray-900 sm:text-[24px]">{text.title}</h1>
        <p className="mt-2.5 break-keep text-[14px] leading-relaxed text-gray-500">{text.body}</p>
        <ul className="mt-6 space-y-2">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-[14px] text-gray-700">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-3.5 shrink-0 text-brand" aria-hidden="true">
                <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {feature}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap items-center gap-2.5">
          {MAC_DOWNLOAD_OPEN && (
            <a
              href={MAC_DOWNLOAD}
              download
              onClick={() => track('app_download_click', { os: 'macos', from: 'deep' })}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              <AppleLogo />
              {text.download}
            </a>
          )}
          <button
            type="button"
            onClick={onHome}
            className="inline-flex h-11 items-center rounded-full border border-gray-300 px-5 text-[14px] font-medium text-gray-800 transition-colors hover:border-gray-500"
          >
            {text.back}
          </button>
        </div>
        <p className="mt-3 text-[12.5px] text-gray-400">{MAC_DOWNLOAD_OPEN ? MAC_SUPPORT : text.soon}</p>
      </div>
    </main>
  )
}
