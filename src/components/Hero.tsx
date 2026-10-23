import type { ReactNode } from 'react'
import { appShell } from '../lib/app'
import { messages, useMessages } from '../lib/i18n'
import { Footer } from './Footer'
import { LofyScript } from './LofyScript'
import { RepoInput, type RepoDraft } from './RepoInput'

/**
 * 메인 화면의 문구예요. 앱에서는 사이드바의 새 분석으로 들어오는 화면이라, 제목과 설명을 짧게 바꿔요.
 * 영어 문구는 누가 놀았는지 잡아내는 도구가 아니라, 누가 무엇을 만들었는지 읽어 주는 도구로 소개해요.
 */
const TEXT = messages({
  ko: {
    title: '우리 프로젝트의 MVP는?',
    description: 'GitHub Repository 링크를 입력하여 누가 프로젝트에 가장 많이 기여했는지, 어떤 기능을 개발했는지 그리고 이 프로젝트의 협업 방식을 알아보거나 훔칠 수도 있답니다.',
    appTitle: '새 분석 시작하기',
    appDescription: 'GitHub Repository 링크를 입력하여 프로젝트에 대해 분석을 시작하세요',
    exploreDescription: '원하는 깃허브 레포지토리 링크를 입력하거나, 아래에서 탐색하여 분석을 시작하세요',
  },
  en: {
    title: 'Who built what in your GitHub repo?',
    description:
      'Paste a GitHub repository link and get a clear, conversational breakdown of the project, contributors, feature ownership, activity patterns, and collaboration style.',
    appTitle: 'Start a new analysis',
    appDescription: 'Paste a GitHub repository link to start analyzing the project',
    exploreDescription: 'Paste a GitHub repository link, or pick one below to start an analysis',
  },
})

const WORD_STAGGER_MS = 80

/** 타이틀을 어절 단위로 나눠요. 어절이 하나씩 흐릿하게 떠오르며 나타나요. */
function Title() {
  const text = useMessages(TEXT)
  const TITLE = appShell ? text.appTitle : text.title
  const TITLE_WORDS = TITLE.split(' ')
  return (
    <h1
      aria-label={TITLE}
      className="text-balance text-center text-[24px] font-semibold leading-snug text-gray-900 sm:text-[30px]"
    >
      {TITLE_WORDS.map((word, index) => (
        <span key={`${TITLE}:${index}`} aria-hidden="true">
          <span className="inline-block animate-word" style={{ animationDelay: `${index * WORD_STAGGER_MS}ms` }}>
            {word}
          </span>
          {index < TITLE_WORDS.length - 1 && ' '}
        </span>
      ))}
    </h1>
  )
}

interface Props {
  onSubmit: (url: string) => void
  /** 입력창에 미리 넣어 둘 링크. 탐색에서 레포를 고르면 넣어요. */
  draft?: RepoDraft | null
  /** 앱에서 입력창 아래에 이어 붙이는 내용(탐색 목록). 있으면 한가운데가 아니라 위쪽에 입력창을 두고, 아래로 스크롤해서 봐요. */
  below?: ReactNode
}

export function Hero({ onSubmit, below, draft }: Props) {
  const text = useMessages(TEXT)

  if (below) {
    return (
      <main className="relative flex-1 overflow-hidden">
        <div className="relative h-full overflow-y-auto px-6 pb-10 md:px-10">
          <div className="mx-auto w-full max-w-lg pt-[max(6rem,16vh)] pb-14">
            <LofyScript className="mx-auto mb-5 h-16 w-auto sm:h-20" />
            <Title />
            <p
              className="mt-3 mb-7 animate-rise text-balance break-keep text-center text-[13px] leading-relaxed text-gray-500 sm:mb-8 sm:text-[14px]"
              style={{ animationDelay: '250ms' }}
            >
              {text.exploreDescription}
            </p>
            {/* 모델 메뉴가 아래의 탐색 목록 위로 펼쳐지게, 입력창 덩어리를 한 칸 앞에 둬요. */}
            <div className="relative z-10 animate-rise" style={{ animationDelay: '350ms' }}>
              <RepoInput onSubmit={onSubmit} draft={draft} />
            </div>
          </div>
          <div className="animate-rise" style={{ animationDelay: '450ms' }}>
            {below}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-5">
      {/* 타이틀, 설명, 입력창을 한 덩어리로 묶어서, 그 덩어리가 화면 정중앙에 오게 해요. */}
      <div className="relative w-full max-w-lg">
        <LofyScript className="mx-auto mb-5 h-16 w-auto sm:h-20" />
        <Title />
        <p
          className="mt-3 mb-7 animate-rise text-balance break-keep text-center text-[13px] leading-relaxed text-gray-500 sm:mb-8 sm:text-[14px]"
          style={{ animationDelay: '250ms' }}
        >
          {appShell ? text.appDescription : text.description}
        </p>
        <div className="relative z-10 animate-rise" style={{ animationDelay: '350ms' }}>
          <RepoInput onSubmit={onSubmit} draft={draft} />
        </div>
      </div>

      <Footer className="absolute inset-x-0 bottom-0" />
    </main>
  )
}
