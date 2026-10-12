import { useEffect, type MouseEvent } from 'react'
import { track } from '../lib/analytics'
import { MAC_DOWNLOAD, MAC_DOWNLOAD_OPEN } from '../lib/app'
import { AppleLogo } from './Header'

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
 * 소개하는 기능이에요. 웹과 앱을 나누지 않고 한 줄에 두 개씩 이어서 보여주고, 앱에서만 되는 것에는 태그를 달아요.
 * 서비스에 실제로 있는 기능만 적어요. 그림은 공개 레포(vitejs/vite)를 앱에서 분석한 실제 화면이에요.
 */
const FEATURES: Feature[] = [
  { title: '프로젝트 요약', body: 'README와 코드를 읽고 정리한 한 문장 소개와 기술 스택', shot: 'intro', alt: '레포 소개 문장과 기술 스택, 기본 정보가 말풍선으로 나온 화면' },
  { title: '기여도 분석', body: '커밋 수와 줄 수, 두 가지 기준으로 비교한 참여자별 기여도', shot: 'contribution', alt: '참여자별 기여도를 커밋 수와 줄 수 기준 막대 그래프로 비교한 화면' },
  { title: '담당 기능 분석', body: '커밋 내용으로 정리한 참여자별 담당 기능과 코드 스타일', shot: 'features', alt: '참여자가 맡은 기능이 번호 목록으로 정리된 화면' },
  { title: '활동 시간 분석', body: '시간대별 커밋 수와 참여자별 활동 시간 히트맵', shot: 'hours', alt: '시간대별 커밋 수 그래프와 참여자별 활동 시간 히트맵 화면' },
  { title: '협업 방식 분석', body: '브랜치, 커밋, PR 규칙을 정리한 팀 규칙 문서와 복사', shot: 'teamwork', alt: '우리 팀에 적용하는 순서와 팀 규칙 문서 복사하기 버튼이 있는 화면' },
  { title: '프로젝트 구조 분석', body: '폴더와 역할을 마인드맵처럼 둘러보는 구조 맵', shot: 'structure', alt: '폴더가 가지처럼 뻗은 프로젝트 구조 맵 화면', tag: APP_ONLY },
  { title: 'CI/CD 파이프라인 구조 분석', body: '워크플로의 작동 조건과 작업이 도는 순서', shot: 'pipeline', alt: '워크플로의 작동 조건과 작업 순서가 카드로 나온 화면', tag: APP_ONLY },
  { title: 'Issues, PR Template', body: '템플릿 양식과 원문, 라벨을 한 화면에', shot: 'forms', alt: '이슈 템플릿의 양식과 원문이 나란히 나온 화면', tag: APP_ONLY },
]

/** 스크린샷을 찍은 창의 가로 폭(px). 창 버튼의 크기와 자리를 이 폭에 맞춰 그려요. */
const SHOT_WIDTH = 1100
/** macOS 창 왼쪽 위의 닫기, 최소화, 확대 버튼 색이에요. 실제 창과 같은 색이라 색 토큰을 쓰지 않아요. */
const WINDOW_BUTTONS = ['#ff5f57', '#febc2e', '#28c840']
/** 그림 폭을 기준으로 한 길이예요. 그림이 커지거나 작아져도 창 버튼이 같은 비율로 따라가요. */
const scaled = (px: number) => `${(px / SHOT_WIDTH) * 100}cqw`

const tagStyle = 'inline-flex h-6 shrink-0 items-center rounded-full border border-gray-300 px-2.5 text-[12px] font-medium text-gray-500'
const primaryButton = 'inline-flex h-12 items-center rounded-full bg-brand px-7 text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover'
const quietButton = 'inline-flex h-12 items-center gap-2 rounded-full border border-gray-300 px-6 text-[15px] font-medium text-gray-800 transition-colors hover:border-gray-500'

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
        className="block aspect-[1600/1018] w-full"
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
 * 서비스를 소개하는 화면이에요.
 * 위에 로고와 한마디, 시작하는 버튼을 두고, 아래에 기능을 한 줄에 두 개씩 실제 화면과 함께 늘어놓아요.
 */
export function About({ onHome }: Props) {
  useEffect(() => {
    document.title = `소개 | ${SITE_TITLE}`
    return () => {
      document.title = SITE_TITLE
    }
  }, [])

  const start = (event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    track('about_cta_click')
    onHome()
  }

  return (
    <main className="flex-1 overflow-x-hidden overflow-y-auto">
      <section className="mx-auto flex w-full max-w-2xl flex-col items-center px-6 pt-32 pb-20 text-center sm:pt-44 sm:pb-28">
        <img src="/logo.svg" alt="WhoIsLoafing" width={3403} height={367} draggable={false} className="h-6 w-auto sm:h-7" />
        <h1 className="mt-8 text-balance break-keep font-semibold leading-[1.2] tracking-[-0.03em] text-gray-900 text-[clamp(30px,6vw,56px)]">레포를 더 쉽게 분석하기</h1>
        <p className="mt-5 text-balance break-keep text-[14px] leading-relaxed text-gray-500 sm:text-[16px]">
          GitHub Repository 링크를 입력하여 누가 프로젝트에 가장 많이 기여했는지, 어떤 기능을 개발했는지 그리고 이 프로젝트의 협업 방식을 알아보거나 훔칠 수도 있답니다.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-2.5">
          <a href="/" onClick={start} className={primaryButton}>
            시작하기
          </a>
          {MAC_DOWNLOAD_OPEN && (
            <a href={MAC_DOWNLOAD} download onClick={() => track('app_download_click', { os: 'macos', from: 'about' })} className={quietButton}>
              <AppleLogo />
              macOS 앱 다운로드
            </a>
          )}
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-7xl gap-x-10 gap-y-14 px-6 pb-20 md:grid-cols-2 md:gap-y-20">
        {FEATURES.map((feature) => (
          <article key={feature.shot} className="min-w-0">
            <Shot feature={feature} />
            <div className="mt-4 flex items-center gap-2.5 md:mt-6">
              <h2 className="min-w-0 break-keep font-semibold leading-snug tracking-[-0.03em] text-gray-900 text-[clamp(19px,2.1vw,26px)]">{feature.title}</h2>
              {feature.tag && <span className={feature.tag === APP_ONLY ? `${tagStyle} border-brand text-brand` : tagStyle}>{feature.tag}</span>}
            </div>
            <p className="mt-1.5 break-keep text-[14px] leading-relaxed text-gray-500 md:mt-2 md:text-[15px]">{feature.body}</p>
          </article>
        ))}
      </div>

      <p className="pb-14 text-center text-[13px] text-gray-500">
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
    </main>
  )
}
