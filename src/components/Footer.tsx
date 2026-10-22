import { track } from '../lib/analytics'
import { openBugReport, useFeedback } from '../lib/feedback'
import { messages, useMessages } from '../lib/i18n'

const TEXT = messages({
  ko: { team: '숨은빚청년들 팀', bug: '버그 신고', rights: '© 2026 Lofy. 모든 권리 보유.' },
  en: { team: 'Made by Hidly', bug: 'Report a bug', rights: '© 2026 Lofy' },
})

/** 메인 화면과 소개 화면 아래에 두는 줄이에요. 왼쪽에 팀 홈페이지 링크와 버그 신고, 오른쪽에 저작권 문구가 있어요. 자리는 쓰는 쪽에서 정해요. */
export function Footer({ className, from }: { className: string; from?: string }) {
  const { ready } = useFeedback()
  const text = useMessages(TEXT)
  return (
    <footer className={`flex items-center justify-between gap-3 whitespace-nowrap px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-[11px] text-gray-400 sm:px-6 sm:text-xs ${className}`}>
      <span className="flex items-center gap-3 sm:gap-4">
      <a
        href="https://hidly.dev/"
        target="_blank"
        rel="noreferrer"
        onClick={() => track('team_link_click', from ? { from } : {})}
        className="inline-flex items-center gap-1 transition-colors hover:text-gray-700"
      >
        {text.team}
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" className="size-3" aria-hidden="true">
          <path d="M3.5 8.5l5-5M4.5 3.5h4v4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>
      {ready && (
        <button type="button" onClick={openBugReport} className="transition-colors hover:text-gray-700">
          {text.bug}
        </button>
      )}
      </span>
      <span>{text.rights}</span>
    </footer>
  )
}
