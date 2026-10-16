import { useEffect, useState } from 'react'
import { track } from '../lib/analytics'
import { MAC_DOWNLOAD, MAC_SUPPORT } from '../lib/app'
import { messages, useMessages } from '../lib/i18n'

interface Props {
  /** 닫아 둔 로그인 안내 아이콘이 왼쪽 아래에 떠 있으면 true. 그 위로 자리를 올려서 겹치지 않게 해요. */
  raised: boolean
}

const CLOSED_KEY = 'whoisloafing:app-nudge-closed'

/** 웹에서는 못 쓰고 앱에서만 쓸 수 있는 기능(FEATURES)이에요. 앱의 심층 분석 탭과 맞춰요. */
const TEXT = messages({
  ko: {
    FEATURES: ['프로젝트 구조를 맵으로 둘러보기', 'CI/CD가 도는 순서 한눈에 보기', '이슈와 PR 템플릿 모아 보기', '참여자가 고친 폴더 살펴보기', '기술 스택과 버전 한눈에 보기'],
    open: '앱 안내 열기',
    close: '닫기',
    title: '여기서 멈추긴 아쉬워요',
    body: '앱에서는 이 레포를 훨씬 깊이 들여다볼 수 있어요.',
    download: 'macOS 앱 다운로드',
  },
  en: {
    FEATURES: ['Explore the project structure as a map', 'See the order your CI/CD jobs run in', 'Browse issue and PR templates', 'See which folders each contributor touched', 'Review the tech stack and versions'],
    open: 'Open app info',
    close: 'Close',
    title: 'Want to go deeper?',
    body: 'The Mac app lets you look into this repo in much more depth.',
    download: 'Download for macOS',
  },
})

function closedBefore(): boolean {
  try {
    return localStorage.getItem(CLOSED_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * 웹에서 채팅을 보는 동안 macOS 앱을 권하는 안내예요. 넓은 화면의 Mac에서만 띄워요.
 * 로그인 안내와 같은 자리(왼쪽 아래)에 같은 모양의 카드로 떠 있고, 닫으면 다운로드 아이콘이 둥둥 떠 있다가 누르면 다시 열려요.
 */
export function AppNudge({ raised }: Props) {
  const [closed, setClosed] = useState(closedBefore)
  const text = useMessages(TEXT)

  useEffect(() => {
    if (!closed) track('app_nudge_view')
  }, [closed])

  function toggle(next: boolean) {
    track(next ? 'app_nudge_close' : 'app_nudge_open')
    setClosed(next)
    try {
      if (next) localStorage.setItem(CLOSED_KEY, '1')
      else localStorage.removeItem(CLOSED_KEY)
    } catch {
      return
    }
  }

  const place = raised ? 'bottom-20' : 'bottom-6'

  if (closed) {
    return (
      <button
        type="button"
        aria-label={text.open}
        onClick={() => toggle(false)}
        className={`nudge-float absolute left-6 z-10 hidden size-11 items-center justify-center rounded-full border border-gray-200 bg-white text-brand transition-colors hover:border-brand hover:bg-brand-soft md:flex ${place}`}
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-5" aria-hidden="true">
          <path d="M10 3.5v9M6 9l4 4 4-4M4 16.5h12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    )
  }

  return (
    <aside
      aria-labelledby="app-nudge-title"
      className={`absolute left-6 z-10 hidden w-[300px] origin-bottom-left animate-pop rounded-2xl border border-gray-200 bg-white p-4 md:block ${place}`}
    >
      <button
        type="button"
        aria-label={text.close}
        onClick={() => toggle(true)}
        className="absolute top-2.5 right-2.5 flex size-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-3.5" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
        </svg>
      </button>
      <h2 id="app-nudge-title" className="pr-7 text-[14px] font-semibold text-gray-900">
        {text.title}
      </h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">{text.body}</p>
      <ul className="mt-2.5 space-y-1.5">
        {text.FEATURES.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-[13px] text-gray-700">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-3.5 shrink-0 text-brand" aria-hidden="true">
              <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {feature}
          </li>
        ))}
      </ul>
      <a
        href={MAC_DOWNLOAD}
        download
        onClick={() => {
          track('app_nudge_click')
          track('app_download_click', { os: 'macos', from: 'nudge' })
        }}
        className="mt-3.5 flex h-9 w-full items-center justify-center rounded-full bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover"
      >
        {text.download}
      </a>
      <p className="mt-2 text-center text-[11.5px] text-gray-400">{MAC_SUPPORT}</p>
    </aside>
  )
}
