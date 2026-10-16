import { useEffect, useLayoutEffect, useRef, type CSSProperties, type MouseEvent } from 'react'
import { track } from '../lib/analytics'
import { MAC_DOWNLOAD, MAC_DOWNLOAD_OPEN } from '../lib/app'
import { localizePath, messages, useLang, useMessages } from '../lib/i18n'
import { applyMeta, HOME_META, SITE_TITLE } from '../lib/meta'
import { Footer } from './Footer'
import { AppleLogo } from './Header'

interface Props {
  onHome: () => void
}

interface Feature {
  /** 기능의 이름. 문장으로 풀지 않고 짧은 이름으로 적어요. */
  title: string
  /** 이름 아래에 붙이는 설명. 겪어 봤을 불편을 먼저 꺼내고, 그 기능으로 무엇을 바로 확인하는지 말해요. */
  body: string
  /** 그 기능의 실제 화면. `public/about`에 있는 그림 이름이에요. */
  shot: string
  /** 화면을 못 보는 사람에게 읽어 줄 그림 설명 */
  alt: string
  /** 쓸 수 있는 조건. 조건이 없으면 적지 않아요. */
  tag?: string
}

/** 기능마다 같은 그림을 써서, 그림 이름으로 묶어요. */
const SHOTS = ['intro', 'contribution', 'features', 'hours', 'teamwork', 'structure', 'pipeline', 'forms'] as const
const APP_ONLY_SHOTS = new Set<string>(['structure', 'pipeline', 'forms'])

type FeatureText = Omit<Feature, 'shot' | 'tag'>

/**
 * 소개 화면의 문구예요. 기능은 웹과 앱을 나누지 않고 한 줄에 두 개씩 이어서 보여주고, 앱에서만 되는 것에는 태그를 달아요.
 * 서비스에 실제로 있는 기능만 적어요. 그림은 공개 레포(vitejs/vite)를 앱에서 분석한 실제 화면이에요.
 * 영어 문구는 감시하거나 탓하는 도구처럼 읽히지 않게, 기여와 맡은 일, 협업 방식을 이해하는 도구로 소개해요.
 */
export const ABOUT_TEXT = messages({
  ko: {
    pageTitle: '소개',
    metaDescription: 'GitHub 레포 링크 하나로 누가 얼마나, 무엇을, 어떻게 만들었는지 읽어 드려요. 기여도와 맡은 기능, 협업 방식을 대화로 풀어 줘요.',
    title: '레포를 더 쉽게 분석하기',
    lead: 'GitHub Repository 링크를 입력하여 누가 프로젝트에 가장 많이 기여했는지, 어떤 기능을 개발했는지 그리고 이 프로젝트의 협업 방식을 알아보거나 훔칠 수도 있답니다.',
    start: '시작하기',
    download: 'macOS 앱 다운로드',
    appOnly: '앱 전용',
    trust: '기여도 숫자는 판결이 아니라 참고할 신호예요. 누군가의 일을 이 숫자 하나로만 재지 말고, 더 나은 대화를 위한 맥락으로 써 주세요.',
    features: [
      { title: '프로젝트 요약', body: '어떤 프로젝트인지 파악하기엔 시간이 아까워요! 프로젝트가 어떤 프로젝트이고, 어떤 기술스택이 사용되었는지 바로 확인해요.', alt: '레포 소개 문장과 기술 스택, 기본 정보가 말풍선으로 나온 화면' },
      { title: '기여도 분석', body: '누가 얼마나 했는지 감으로만 알고 있었나요? 커밋 수와 줄 수, 두 가지 기준으로 참여자별 기여도를 한눈에 비교해요.', alt: '참여자별 기여도를 커밋 수와 줄 수 기준 막대 그래프로 비교한 화면' },
      { title: '담당 기능 분석', body: '커밋 기록을 하나하나 뒤지기엔 너무 많아요! 누가 어떤 기능을 만들었고, 어떤 스타일로 코드를 쓰는지 바로 확인해요.', alt: '참여자가 맡은 기능이 번호 목록으로 정리된 화면' },
      { title: '활동 시간 분석', body: '우리 팀은 언제 가장 열심히 일했을까요? 시간대별 커밋 수와 참여자별 활동 시간을 그래프로 확인해요.', alt: '시간대별 커밋 수 그래프와 참여자별 활동 시간 히트맵 화면' },
      { title: '협업 방식 분석', body: '잘하는 팀은 어떻게 일하는지 궁금하지 않나요? 브랜치, 커밋, PR 규칙을 정리해서 팀 규칙 문서로 바로 가져가요.', alt: '우리 팀에 적용하는 순서와 팀 규칙 문서 복사하기 버튼이 있는 화면' },
      { title: '프로젝트 구조 분석', body: '폴더를 하나씩 열어 보기엔 너무 많아요! 어떤 폴더가 무슨 역할을 하는지 맵으로 한눈에 둘러봐요.', alt: '폴더가 가지처럼 뻗은 프로젝트 구조 맵 화면' },
      { title: 'CI/CD 파이프라인 구조 분석', body: '워크플로 파일만 봐서는 헷갈려요! 언제, 어떤 순서로 작업이 도는지 한 화면에서 확인해요.', alt: '워크플로의 작동 조건과 작업 순서가 카드로 나온 화면' },
      { title: 'Issues, PR Template', body: '템플릿을 처음부터 만들기엔 막막해요! 이 팀이 쓰는 이슈와 PR 템플릿을 양식 그대로 보고 바로 복사해요.', alt: '이슈 템플릿의 양식과 원문이 나란히 나온 화면' },
    ] as FeatureText[],
  },
  en: {
    pageTitle: 'About',
    metaDescription: 'Turn any GitHub repository into a clear story of contribution, ownership, and teamwork.',
    title: 'Who built what in your GitHub repo?',
    lead: 'Turn any GitHub repository into a clear story of contribution, ownership, and teamwork. Understand the project, contributors, feature ownership, activity patterns, and team workflow from a single repo link.',
    start: 'Get started',
    download: 'Download for macOS',
    appOnly: 'Mac app',
    trust: "Contribution numbers are signals, not verdicts. Use them as context for better conversations, not as the only measure of someone's work.",
    features: [
      { title: 'Project summary', body: 'Quickly understand what the repo is and what technologies it uses.', alt: 'Chat bubbles with a one-line repo summary, its tech stack, and basic facts' },
      { title: 'Contribution analysis', body: 'Compare commits and line changes by contributor, with context.', alt: 'Bar charts comparing each contributor by commits and by lines changed' },
      { title: 'Feature ownership', body: 'See which parts of the product each contributor likely worked on.', alt: 'A numbered list of features each contributor worked on' },
      { title: 'Activity patterns', body: 'Understand when the team was active and how work moved over time.', alt: 'Commits by hour of day and a heatmap of each contributor\'s active hours' },
      { title: 'Team workflow', body: 'Learn branching, commit, PR, and collaboration patterns from the repo.', alt: 'Steps to adopt the workflow and a button that copies a team rules document' },
      { title: 'Project structure', body: 'Explore what folders and modules do.', alt: 'A mind map of the project folders branching out' },
      { title: 'CI/CD pipeline', body: 'Understand when workflows run and what they do.', alt: 'Cards showing workflow triggers and the order jobs run in' },
      { title: 'Issues and PR templates', body: "Learn from the team's templates and reuse useful patterns.", alt: 'An issue template rendered as a form next to its source' },
    ],
  },
})

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
 * 스크롤해서 내려가면 기능이 차례로 떠올라요.
 */
export function About({ onHome }: Props) {
  const scrollRef = useRef<HTMLElement>(null)
  const lang = useLang()
  const text = useMessages(ABOUT_TEXT)
  const features: Feature[] = text.features.map((feature, index) => ({
    ...feature,
    shot: SHOTS[index],
    tag: APP_ONLY_SHOTS.has(SHOTS[index]) ? text.appOnly : undefined,
  }))

  useEffect(() => {
    applyMeta({ title: `${ABOUT_TEXT[lang].pageTitle} | ${SITE_TITLE}`, description: ABOUT_TEXT[lang].metaDescription }, lang, '/about')
    return () => applyMeta(HOME_META[lang], lang, '/')
  }, [lang])

  // 스크롤해서 화면에 들어온 기능부터 떠오르게 해요. 처음부터 보이는 것은 그리기 전에 바로 표시해서 깜빡이지 않게 해요.
  useLayoutEffect(() => {
    const root = scrollRef.current
    if (!root || !('IntersectionObserver' in window)) return
    const targets = [...root.querySelectorAll<HTMLElement>('[data-reveal]')]
    const limit = window.innerHeight
    for (const target of targets) {
      if (target.getBoundingClientRect().top < limit) target.dataset.shown = ''
    }
    root.dataset.armed = ''
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          ;(entry.target as HTMLElement).dataset.shown = ''
          observer.unobserve(entry.target)
        }
      },
      { root, rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )
    targets.filter((target) => target.dataset.shown === undefined).forEach((target) => observer.observe(target))
    return () => observer.disconnect()
  }, [])

  const start = (event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    track('about_cta_click')
    onHome()
  }

  return (
    <main ref={scrollRef} className="flex-1 overflow-x-hidden overflow-y-auto">
      <section className="mx-auto flex w-full max-w-2xl flex-col items-center px-6 pt-32 pb-20 text-center sm:pt-44 sm:pb-28">
        <img src="/logo.svg" alt="WhoIsLoafing" width={3403} height={367} draggable={false} className="h-6 w-auto sm:h-7" />
        <h1 className="mt-8 text-balance break-keep font-semibold leading-[1.2] tracking-[-0.03em] text-gray-900 text-[clamp(30px,6vw,56px)]">{text.title}</h1>
        <p className="mt-5 text-balance break-keep text-[14px] leading-relaxed text-gray-500 sm:text-[16px]">
          {text.lead}
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-2.5">
          <a href={localizePath('/')} onClick={start} className={primaryButton}>
            {text.start}
          </a>
          {MAC_DOWNLOAD_OPEN && (
            <a href={MAC_DOWNLOAD} download onClick={() => track('app_download_click', { os: 'macos', from: 'about' })} className={quietButton}>
              <AppleLogo />
              {text.download}
            </a>
          )}
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-7xl gap-x-10 gap-y-14 px-6 pb-20 md:grid-cols-2 md:gap-y-20">
        {features.map((feature, index) => (
          // 한 줄의 오른쪽 기능은 왼쪽보다 조금 늦게 떠올라요.
          <article key={feature.shot} data-reveal style={{ '--reveal-delay': `${(index % 2) * 140}ms` } as CSSProperties} className="min-w-0">
            <Shot feature={feature} />
            <div className="mt-4 flex items-center gap-2.5 md:mt-6">
              <h2 className="min-w-0 break-keep font-semibold leading-snug tracking-[-0.03em] text-gray-900 text-[clamp(19px,2.1vw,26px)]">{feature.title}</h2>
              {feature.tag && <span className={`${tagStyle} border-brand text-brand`}>{feature.tag}</span>}
            </div>
            <p className="mt-1.5 break-keep text-[14px] leading-relaxed text-gray-500 md:mt-2 md:text-[15px]">{feature.body}</p>
          </article>
        ))}
      </div>

      <p className="mx-auto max-w-2xl px-6 text-balance break-keep text-center text-[13px] leading-relaxed text-gray-400 sm:text-[14px]">{text.trust}</p>

      <Footer className="mt-10" from="about" />
    </main>
  )
}
