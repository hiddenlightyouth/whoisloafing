import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { track } from '../lib/analytics'
import { MAC_DOWNLOAD, MAC_DOWNLOAD_OPEN } from '../lib/app'

interface Props {
  onHome: () => void
}

const SITE_TITLE = 'WhoIsLoafing'

interface Slide {
  /** 한 장에 크게 적는 말. 설명 없이 이 한마디로 기능을 알려줘요. */
  title: string
  /** 쓸 수 있는 조건. 조건이 없으면 적지 않아요. */
  tag?: string
}

const APP_ONLY = '앱 전용'

/** 소개하는 기능이에요. 웹과 앱을 나누지 않고 한 줄로 이어서 보여주고, 앱에서만 되는 것에는 태그를 달아요. 서비스에 실제로 있는 기능만 적어요. */
const FEATURES: Slide[] = [
  { title: '어떤 프로젝트인지 한 문장으로 알려줘요' },
  { title: '누가 얼마나 기여했는지 보여줘요' },
  { title: '누가 어떤 기능을 만들었는지 정리해요' },
  { title: '팀이 언제, 어떻게 일했는지 그려줘요' },
  { title: '잘하는 팀의 협업 방식을 그대로 가져와요' },
  { title: '분석을 저장하고 링크로 공유해요', tag: '로그인 필요' },
  { title: '프로젝트 구조를 맵으로 둘러봐요', tag: APP_ONLY },
  { title: 'CI/CD와 이슈, PR 템플릿을 한눈에 봐요', tag: APP_ONLY },
  { title: '인기 있는 레포를 골라 바로 분석해요', tag: APP_ONLY },
]

const HERO_TITLE = '링크 하나로 레포를 읽어 드려요'
const LAST_TITLE = '우리 프로젝트의 MVP가 궁금한가요?'
const SLIDE_NAMES = ['처음', ...FEATURES.map((feature) => feature.title), '시작하기']

/** 어절이 떠오르는 간격 */
const WORD_STAGGER_MS = 90
const delay = (ms: number) => ({ '--reveal-delay': `${ms}ms` }) as CSSProperties

const slide = 'relative flex h-full snap-start snap-always flex-col items-center justify-center px-6 text-center'
const headline = 'max-w-4xl text-balance break-keep font-semibold leading-[1.2] tracking-[-0.03em] text-gray-900 text-[clamp(30px,6.4vw,68px)]'
const tagStyle = 'inline-flex h-8 items-center rounded-full border border-gray-300 px-3.5 text-[13px] font-medium text-gray-500'
const primaryButton = 'inline-flex h-12 items-center rounded-full bg-brand px-7 text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover'
const quietButton = 'inline-flex h-12 items-center rounded-full border border-gray-300 px-7 text-[15px] font-medium text-gray-800 transition-colors hover:border-gray-500'

/** 큰 글자를 어절로 나눠서, 그 장이 화면에 들어올 때 하나씩 떠오르게 해요. */
function Words({ text, from = 0 }: { text: string; from?: number }) {
  const words = text.split(' ')
  return (
    <>
      {words.map((word, index) => (
        <span key={index} aria-hidden="true">
          <span data-rise style={delay(from + index * WORD_STAGGER_MS)} className="inline-block">
            {word}
          </span>
          {index < words.length - 1 && ' '}
        </span>
      ))}
    </>
  )
}

/** 글자가 다 떠오른 뒤에 따라 나오는 조각이에요. */
function After({ text, extra = 0, className, children }: { text: string; extra?: number; className?: string; children: ReactNode }) {
  return (
    <div data-rise style={delay(text.split(' ').length * WORD_STAGGER_MS + 120 + extra)} className={className}>
      {children}
    </div>
  )
}

/**
 * 서비스의 기능을 한 장에 하나씩 보여주는 소개 화면이에요. 이 화면만 바탕이 새까맣고,
 * 스크롤하면 한 장씩 걸리듯 넘어가면서 그 장의 글자가 떠올라요.
 */
export function About({ onHome }: Props) {
  const scrollRef = useRef<HTMLElement>(null)
  const [active, setActive] = useState(0)

  useEffect(() => {
    document.title = `소개 | ${SITE_TITLE}`
    return () => {
      document.title = SITE_TITLE
    }
  }, [])

  // 화면을 절반 넘게 차지한 장의 글자를 띄우고, 거의 다 나간 장은 다음에 다시 떠오르게 숨겨 둬요.
  useLayoutEffect(() => {
    const root = scrollRef.current
    if (!root || !('IntersectionObserver' in window)) return
    const slides = [...root.querySelectorAll<HTMLElement>('[data-reveal]')]
    slides[0].dataset.shown = ''
    root.dataset.armed = ''
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const target = entry.target as HTMLElement
          if (entry.intersectionRatio >= 0.55) {
            target.dataset.shown = ''
            setActive(slides.indexOf(target))
          } else if (entry.intersectionRatio < 0.15) delete target.dataset.shown
        }
      },
      { root, threshold: [0.15, 0.55] },
    )
    slides.forEach((item) => observer.observe(item))
    return () => observer.disconnect()
  }, [])

  const go = (index: number) => {
    const root = scrollRef.current
    root?.scrollTo({ top: index * root.clientHeight, behavior: 'smooth' })
  }

  const start = (event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    track('about_cta_click')
    onHome()
  }

  return (
    <>
      <main ref={scrollRef} className="about-scroll flex-1 snap-y snap-mandatory overflow-x-hidden overflow-y-auto overscroll-y-contain">
        <section data-reveal className={slide}>
          <h1 aria-label={HERO_TITLE} className={headline}>
            <Words text={HERO_TITLE} from={350} />
          </h1>
          <After text={HERO_TITLE} extra={350} className="mt-6 text-[15px] text-gray-500 sm:text-[17px]">
            WhoIsLoafing이 할 수 있는 일을 하나씩 보여드릴게요.
          </After>
          <After text={HERO_TITLE} extra={650} className="absolute bottom-8">
            <button
              type="button"
              aria-label="다음 장으로"
              onClick={() => go(1)}
              className="flex size-11 items-center justify-center rounded-full text-gray-500 transition-colors hover:text-gray-900"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-5" aria-hidden="true">
                <path d="M3.5 6l4.5 4.5L12.5 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </After>
        </section>

        {FEATURES.map((feature) => (
          <section key={feature.title} data-reveal className={slide}>
            <h2 aria-label={feature.title} className={headline}>
              <Words text={feature.title} />
            </h2>
            {feature.tag && (
              <After text={feature.title} className="mt-7">
                <span className={feature.tag === APP_ONLY ? `${tagStyle} border-brand text-brand` : tagStyle}>{feature.tag}</span>
              </After>
            )}
          </section>
        ))}

        <section data-reveal className={slide}>
          <h2 aria-label={LAST_TITLE} className={headline}>
            <Words text={LAST_TITLE} />
          </h2>
          <After text={LAST_TITLE} className="mt-9 flex flex-wrap justify-center gap-2.5">
            <a href="/" onClick={start} className={primaryButton}>
              레포 분석하러 가기
            </a>
            {MAC_DOWNLOAD_OPEN && (
              <a href={MAC_DOWNLOAD} download onClick={() => track('app_download_click', { os: 'macos', from: 'about' })} className={quietButton}>
                macOS 앱 다운로드
              </a>
            )}
          </After>
          <After text={LAST_TITLE} extra={200} className="absolute bottom-8 text-[13px] text-gray-500">
            WhoIsLoafing은{' '}
            <a
              href="https://hidly.dev/"
              target="_blank"
              rel="noreferrer"
              onClick={() => track('team_link_click', { from: 'about' })}
              className="font-medium text-gray-700 transition-colors hover:text-gray-900"
            >
              숨은빚청년들 팀
            </a>
            이 만들어요.
          </After>
        </section>
      </main>

      {/* 지금 몇 번째 장인지 알려 주는 점이에요. 누르면 그 장으로 가요. */}
      <nav aria-label="소개 화면의 장" className="absolute top-1/2 right-3 z-10 hidden -translate-y-1/2 flex-col sm:right-5 sm:flex">
        {SLIDE_NAMES.map((name, index) => (
          <button
            key={index}
            type="button"
            aria-label={name}
            aria-current={index === active ? 'step' : undefined}
            onClick={() => go(index)}
            className="group flex size-5 items-center justify-center"
          >
            <span className={`rounded-full transition-all duration-300 ${index === active ? 'h-4 w-1.5 bg-gray-900' : 'size-1.5 bg-gray-300 group-hover:bg-gray-500'}`} />
          </button>
        ))}
      </nav>
    </>
  )
}
