import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { track } from '../lib/analytics'
import { MAC_DOWNLOAD, MAC_DOWNLOAD_OPEN } from '../lib/app'

interface Props {
  onHome: () => void
}

const SITE_TITLE = 'WhoIsLoafing'

interface Feature {
  /** 기능의 이름. 문장으로 풀지 않고 짧은 이름으로 적어요. */
  title: string
  /** 이름 아래에 붙이는 한 줄 설명 */
  body: string
  /** 그 기능의 실제 화면. `public/about`에 있는 그림 이름이에요. */
  shot: string
  /** 화면을 못 보는 사람에게 읽어 줄 그림 설명 */
  alt: string
  /** 쓸 수 있는 조건. 조건이 없으면 적지 않아요. */
  tag?: string
}

const APP_ONLY = '앱 전용'

/**
 * 소개하는 기능이에요. 웹과 앱을 나누지 않고 한 장에 두 개씩 이어서 보여주고, 앱에서만 되는 것에는 태그를 달아요.
 * 서비스에 실제로 있는 기능만 적어요. 그림은 공개 레포(vitejs/vite)를 앱의 다크 모드에서 분석한 실제 화면이에요.
 */
const FEATURES: Feature[] = [
  { title: '프로젝트 요약', body: 'README와 코드를 읽고 정리한 한 문장 소개와 기술 스택', shot: 'intro', alt: '레포 소개 문장과 기술 스택, 기본 정보가 말풍선으로 나온 화면' },
  { title: '기여도 분석', body: '커밋 수와 줄 수, 두 가지 기준으로 비교한 참여자별 기여도', shot: 'contribution', alt: '참여자별 기여도를 커밋 수와 줄 수 기준 막대 그래프로 비교한 화면' },
  { title: '담당 기능 분석', body: '커밋 내용으로 정리한 참여자별 담당 기능과 코드 스타일', shot: 'features', alt: '참여자가 맡은 기능이 번호 목록으로 정리된 화면' },
  { title: '활동 시간 분석', body: '시간대별 커밋 수와 참여자별 활동 시간 히트맵', shot: 'hours', alt: '시간대별 커밋 수 그래프와 참여자별 활동 시간 히트맵 화면' },
  { title: '협업 방식 분석', body: '브랜치, 커밋, PR 규칙을 정리한 팀 규칙 문서와 복사', shot: 'teamwork', alt: '우리 팀에 적용하는 순서와 팀 규칙 문서 복사하기 버튼이 있는 화면' },
  { title: '저장과 공유', body: '내 작업에 모아 두고 링크 하나로 공유', shot: 'save', alt: '내 작업 목록과 채팅 공유 확인 창이 떠 있는 화면', tag: '로그인 필요' },
  { title: '프로젝트 구조 분석', body: '폴더와 역할을 마인드맵처럼 둘러보는 구조 맵', shot: 'structure', alt: '폴더가 가지처럼 뻗은 프로젝트 구조 맵 화면', tag: APP_ONLY },
  { title: 'CI/CD 파이프라인 구조 분석', body: '워크플로의 작동 조건과 작업이 도는 순서', shot: 'pipeline', alt: '워크플로의 작동 조건과 작업 순서가 카드로 나온 화면', tag: APP_ONLY },
  { title: 'Issues, PR Template', body: '템플릿 양식과 원문, 라벨을 한 화면에', shot: 'forms', alt: '이슈 템플릿의 양식과 원문이 나란히 나온 화면', tag: APP_ONLY },
  { title: '인기있는 레포 둘러보기', body: 'GitHub에서 인기 있는 공개 레포를 골라 바로 분석', shot: 'explore', alt: '인기 있는 레포 카드가 늘어선 탐색 화면', tag: APP_ONLY },
]

/** 한 장에 기능을 두 개씩 묶어요. */
const PAIRS: Feature[][] = FEATURES.reduce<Feature[][]>((pairs, feature, index) => {
  if (index % 2 === 0) pairs.push([feature])
  else pairs[pairs.length - 1].push(feature)
  return pairs
}, [])

const SLIDE_NAMES = ['처음', ...PAIRS.map((pair) => pair.map((feature) => feature.title).join(', ')), '시작하기']

/** 스크린샷을 찍은 창의 가로 폭(px). 창 버튼의 크기와 자리를 이 폭에 맞춰 그려요. */
const SHOT_WIDTH = 1100
/** macOS 창 왼쪽 위의 닫기, 최소화, 확대 버튼 색이에요. 실제 창과 같은 색이라 색 토큰을 쓰지 않아요. */
const WINDOW_BUTTONS = ['#ff5f57', '#febc2e', '#28c840']
/** 그림 폭을 기준으로 한 길이예요. 그림이 커지거나 작아져도 창 버튼이 같은 비율로 따라가요. */
const scaled = (px: number) => `${(px / SHOT_WIDTH) * 100}cqw`

const slide = 'relative flex h-full snap-start snap-always flex-col items-center justify-center px-6 text-center'
const headline = 'max-w-4xl text-balance break-keep font-semibold leading-[1.2] tracking-[-0.03em] text-gray-900 text-[clamp(30px,6.4vw,68px)]'
const tagStyle = 'inline-flex h-6 shrink-0 items-center rounded-full border border-gray-300 px-2.5 text-[12px] font-medium text-gray-500'
const primaryButton = 'inline-flex h-12 items-center rounded-full bg-brand px-7 text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover'
const quietButton = 'inline-flex h-12 items-center rounded-full border border-gray-300 px-7 text-[15px] font-medium text-gray-800 transition-colors hover:border-gray-500'

/** 앱 화면의 스크린샷이에요. 실제 앱 창처럼 왼쪽 위에 창 버튼 세 개를 얹어요. */
function Shot({ feature }: { feature: Feature }) {
  return (
    <div className="@container relative overflow-hidden rounded-xl border border-gray-200 sm:rounded-2xl">
      <img
        src={`/about/${feature.shot}.webp`}
        alt={feature.alt}
        width={1600}
        height={1018}
        loading="lazy"
        draggable={false}
        className="block aspect-[1600/1018] w-full max-md:max-h-[24dvh] max-md:object-cover max-md:object-top"
      />
      <span aria-hidden className="absolute flex" style={{ top: scaled(10), left: scaled(13), gap: scaled(8) }}>
        {WINDOW_BUTTONS.map((color) => (
          <span key={color} className="rounded-full" style={{ width: scaled(12), height: scaled(12), background: color }} />
        ))}
      </span>
    </div>
  )
}

/**
 * 서비스의 기능을 한 장에 두 개씩, 실제 화면과 이름, 한 줄 설명으로 보여주는 소개 화면이에요.
 * 이 화면만 바탕이 새까맣고, 스크롤하면 한 장씩 걸리듯 넘어가요.
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

  // 화면을 절반 넘게 차지한 장을 오른쪽 점에 표시해요.
  useEffect(() => {
    const root = scrollRef.current
    if (!root || !('IntersectionObserver' in window)) return
    const slides = [...root.querySelectorAll<HTMLElement>('section')]
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(slides.indexOf(entry.target as HTMLElement))
        }
      },
      { root, threshold: 0.55 },
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
        <section className={slide}>
          <h1 className={headline}>링크 하나로 레포를 읽어 드려요</h1>
          <p className="mt-6 text-[15px] text-gray-500 sm:text-[17px]">WhoIsLoafing이 할 수 있는 일을 하나씩 보여드릴게요.</p>
          <button
            type="button"
            aria-label="다음 장으로"
            onClick={() => go(1)}
            className="absolute bottom-8 flex size-11 items-center justify-center rounded-full text-gray-500 transition-colors hover:text-gray-900"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-5" aria-hidden="true">
              <path d="M3.5 6l4.5 4.5L12.5 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </section>

        {PAIRS.map((pair, order) => (
          <section key={order} className={slide}>
            <div className="grid w-full max-w-7xl gap-5 pt-14 text-left sm:gap-8 md:grid-cols-2 md:gap-10 md:pt-0">
              {pair.map((feature) => (
                <article key={feature.shot} className="min-w-0">
                  <Shot feature={feature} />
                  <div className="mt-3.5 flex items-center gap-2.5 md:mt-6">
                    <h2 className="min-w-0 break-keep font-semibold leading-snug tracking-[-0.03em] text-gray-900 text-[clamp(18px,2.1vw,26px)]">{feature.title}</h2>
                    {feature.tag && <span className={feature.tag === APP_ONLY ? `${tagStyle} border-brand text-brand` : tagStyle}>{feature.tag}</span>}
                  </div>
                  <p className="mt-1 break-keep text-[13.5px] leading-relaxed text-gray-500 md:mt-2 md:text-[15px]">{feature.body}</p>
                </article>
              ))}
            </div>
          </section>
        ))}

        <section className={slide}>
          <h2 className={headline}>우리 프로젝트의 MVP가 궁금한가요?</h2>
          <div className="mt-9 flex flex-wrap justify-center gap-2.5">
            <a href="/" onClick={start} className={primaryButton}>
              레포 분석하러 가기
            </a>
            {MAC_DOWNLOAD_OPEN && (
              <a href={MAC_DOWNLOAD} download onClick={() => track('app_download_click', { os: 'macos', from: 'about' })} className={quietButton}>
                macOS 앱 다운로드
              </a>
            )}
          </div>
          <p className="absolute bottom-8 text-[13px] text-gray-500">
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
          </p>
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
