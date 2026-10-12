import { useEffect, useLayoutEffect, useRef, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { track } from '../lib/analytics'
import { MAC_DOWNLOAD, MAC_DOWNLOAD_OPEN, MAC_SUPPORT } from '../lib/app'

interface Props {
  onHome: () => void
  onArticles: () => void
}

const SITE_TITLE = 'WhoIsLoafing'

const primaryButton = 'inline-flex h-11 items-center rounded-full bg-brand px-6 text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover'
const quietButton = 'inline-flex h-11 items-center rounded-full bg-gray-100 px-6 text-[15px] font-medium text-gray-700 transition-colors hover:text-brand'
const panel = 'rounded-3xl border border-gray-200 bg-white p-5 sm:p-7'
const bubble = 'max-w-[88%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed'
const botBubble = `${bubble} rounded-bl-md bg-gray-100 text-gray-900`

/** 떠오르는 순서를 조금씩 늦춰요. 덩어리(data-reveal)는 화면에 들어올 때, 그 안의 조각(data-rise)은 덩어리가 보인 뒤에 차례로 떠올라요. */
const delay = (ms: number) => ({ '--reveal-delay': `${ms}ms` }) as CSSProperties

/** 같은 페이지 안에서 화면만 바꾸는 링크. 새 탭으로 열기 같은 브라우저 기본 동작은 그대로 둬요. */
function InnerLink({ href, onNavigate, className, children }: { href: string; onNavigate: () => void; className: string; children: ReactNode }) {
  return (
    <a
      href={href}
      onClick={(event: MouseEvent) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
        event.preventDefault()
        onNavigate()
      }}
      className={className}
    >
      {children}
    </a>
  )
}

// 아래의 그림들은 기능이 어떤 모습인지 작게 흉내 낸 예시예요. 그림 파일 없이 직접 그리고, 들어 있는 팀과 숫자는 지어낸 거예요.

function IntroVisual() {
  return (
    <div className={`${panel} flex flex-col gap-2.5`}>
      <p className={`${bubble} ml-auto rounded-br-md bg-brand text-white`}>github.com/our-team/project</p>
      <p data-rise style={delay(250)} className={botBubble}>
        동아리 행사 신청을 받는 웹 서비스의 <strong className="font-semibold">프론트엔드 레포</strong>네요.
      </p>
      <div data-rise style={delay(450)} className={`${botBubble} w-full`}>
        <p className="text-[13px] font-semibold">기술 스택</p>
        <dl className="mt-2 space-y-1.5 text-[13px]">
          {[
            ['언어', 'TypeScript'],
            ['프레임워크', 'React, Vite'],
            ['배포', 'Cloudflare Workers'],
          ].map(([kind, value]) => (
            <div key={kind} className="flex gap-3">
              <dt className="w-16 shrink-0 text-gray-500">{kind}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

function Bars({ title, people }: { title: string; people: [string, number][] }) {
  return (
    <div className="rounded-2xl bg-gray-100 p-4">
      <p className="text-[13px] font-semibold text-gray-900">{title}</p>
      <ul className="mt-3 space-y-2.5">
        {people.map(([name, percent]) => (
          <li key={name} className="flex items-center gap-3 text-[13px]">
            <span className="w-8 shrink-0 text-gray-600">{name}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-white">
              <span data-grow className="block h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
            </span>
            <span className="w-9 shrink-0 text-right text-gray-500 tabular-nums">{percent}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ShareVisual() {
  return (
    <div className={`${panel} grid gap-3`}>
      <Bars
        title="커밋 수 기준"
        people={[
          ['민지', 46],
          ['도윤', 33],
          ['서연', 21],
        ]}
      />
      <Bars
        title="줄 수 기준"
        people={[
          ['도윤', 41],
          ['민지', 38],
          ['서연', 21],
        ]}
      />
    </div>
  )
}

function FeaturesVisual() {
  const items = ['행사 신청 양식과 입력 검증', '신청 내역 목록과 검색', '관리자용 승인 화면', '로그인과 권한 확인']
  return (
    <div className={panel}>
      <div className={`${botBubble} w-full max-w-none`}>
        <p className="text-[13px] font-semibold">민지 님이 맡은 기능</p>
        <ol className="mt-2.5 space-y-2">
          {items.map((item, index) => (
            <li key={item} data-rise style={delay(250 + index * 130)} className="flex gap-2.5 text-[14px]">
              <span className="w-4 shrink-0 text-gray-400 tabular-nums">{index + 1}</span>
              {item}
            </li>
          ))}
        </ol>
      </div>
      <p data-rise style={delay(800)} className={`${botBubble} mt-2.5`}>
        화면을 작은 컴포넌트로 잘게 나누고, <strong className="font-semibold">이름을 길더라도 분명하게</strong> 짓는 편이에요.
      </p>
    </div>
  )
}

const DAYS = ['월', '화', '수', '목', '금', '토', '일']
/** 요일마다 시간대별로 얼마나 활동했는지(0부터 4)를 적은 예시예요. 밤과 주말에 몰려 있어요. */
const HEAT = ['000112233410', '000011234310', '000012123420', '000001233410', '000112234431', '001223344432', '001123344320']
const HEAT_TONE = ['bg-gray-100', 'bg-brand/20', 'bg-brand/45', 'bg-brand/70', 'bg-brand']

function HoursVisual() {
  return (
    <div className={panel}>
      <p className="text-[13px] font-semibold text-gray-900">요일과 시간대별 활동</p>
      <div className="mt-4 space-y-1.5">
        {HEAT.map((row, day) => (
          <div key={day} className="flex items-center gap-2.5">
            <span className="w-4 shrink-0 text-[12px] text-gray-400">{DAYS[day]}</span>
            <div className="grid flex-1 grid-cols-12 gap-1.5">
              {[...row].map((level, hour) => (
                <span key={hour} data-rise style={delay(150 + (day + hour) * 35)} className={`aspect-square rounded-[5px] ${HEAT_TONE[Number(level)]}`} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex justify-between pl-6.5 text-[12px] text-gray-400 tabular-nums">
        <span>0시</span>
        <span>12시</span>
        <span>22시</span>
      </div>
      <p data-rise style={delay(900)} className={`${botBubble} mt-4`}>
        <strong className="font-semibold">밤늦게, 주말에 몰아서</strong> 작업하는 팀이네요.
      </p>
    </div>
  )
}

function TeamworkVisual() {
  const rules = [
    ['브랜치', 'feat/12-apply-form'],
    ['커밋', 'feat: 신청 양식 검증 추가'],
    ['PR', '스쿼시 머지, 리뷰 한 명 이상'],
    ['이슈', '템플릿 두 가지, 라벨로 분류'],
  ]
  return (
    <div className={panel}>
      <p className="text-[13px] font-semibold text-gray-900">이 팀의 규칙</p>
      <dl className="mt-3">
        {rules.map(([kind, value], index) => (
          <div key={kind} data-rise style={delay(200 + index * 120)} className="flex gap-4 border-t border-gray-100 py-3 text-[13.5px] first:border-t-0">
            <dt className="w-12 shrink-0 text-gray-500">{kind}</dt>
            <dd className="min-w-0 font-mono text-[12.5px] tracking-normal break-all text-gray-800">{value}</dd>
          </div>
        ))}
      </dl>
      <span data-rise style={delay(750)} className="mt-3 inline-flex h-9 items-center rounded-lg bg-brand px-3.5 text-[13px] font-semibold text-white">
        팀 규칙 문서 복사하기
      </span>
    </div>
  )
}

function HistoryVisual() {
  const chats: [string, string, string, boolean][] = [
    ['O', 'our-team/project', '오후 3:12', true],
    ['V', 'vitejs/vite', '어제', false],
    ['S', 'spring-projects/spring-boot', '10월 3일', false],
  ]
  return (
    <div className={panel}>
      <p className="text-[13px] font-semibold text-gray-900">내 작업</p>
      <ul className="mt-2">
        {chats.map(([initial, repo, when, shared], index) => (
          <li key={repo} data-rise style={delay(200 + index * 130)} className="flex items-center gap-3 border-t border-gray-100 py-3 first:border-t-0">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[14px] font-semibold text-brand-hover">{initial}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold text-gray-900">{repo}</span>
              <span className="block text-[12px] text-gray-400">{when}</span>
            </span>
            {shared && <span className="shrink-0 text-xs font-medium text-brand">공유함</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function DeepVisual() {
  const folders: [string, string][] = [
    ['src/components', '화면을 이루는 부품'],
    ['src/lib', '서버 호출과 공통 도구'],
    ['public', '로고와 미리보기 이미지'],
  ]
  return (
    <div className={`${panel} bg-gray-50`}>
      <div className="flex items-center">
        <span className="shrink-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-[13px] font-semibold text-gray-900">project</span>
        <svg viewBox="0 0 40 180" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-[180px] w-8 shrink-0 text-gray-300 sm:w-10" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 90C22 90 18 30 40 30M0 90h40M0 90c22 0 18 60 40 60" />
        </svg>
        <div className="flex min-w-0 flex-1 flex-col justify-between self-stretch">
          {folders.map(([name, role], index) => (
            <div key={name} data-rise style={delay(250 + index * 150)} className="rounded-xl border border-gray-200 bg-white px-3.5 py-2">
              <p className="truncate text-[13px] font-semibold text-gray-900">{name}</p>
              <p className="truncate text-[12px] text-gray-500">{role}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface Feature {
  title: string
  body: string
  visual: ReactNode
  /** 설명 아래에 붙이는 링크 */
  extra?: ReactNode
}

/** 소개하는 기능이에요. 서비스에 실제로 있는 것만 적어요. 기능이 바뀌면 같이 고쳐요. */
const FEATURES: Feature[] = [
  {
    title: '어떤 프로젝트인지, 한 문장으로',
    body: 'README와 폴더 구조, 의존성 파일을 읽고 어떤 서비스의 어떤 레포인지 정리해요. 기술 스택은 언어, 프레임워크, 데이터베이스, 배포 도구로 나눠서 보여줘요.',
    visual: <IntroVisual />,
  },
  {
    title: '기여도는 두 가지 기준으로',
    body: '참여자마다 커밋 수와 고친 줄 수를 세고, 기여도를 커밋 기준과 줄 수 기준으로 나란히 보여줘요. 한쪽 숫자만으로 줄 세우지 않아요.',
    visual: <ShareVisual />,
  },
  {
    title: '누가 무엇을 만들었는지',
    body: '커밋 내용을 읽고 참여자가 맡은 기능을 목록으로 정리해요. 코드를 어떤 스타일로 쓰는 사람인지도 함께 알려줘요.',
    visual: <FeaturesVisual />,
  },
  {
    title: '팀이 언제, 어떻게 움직였는지',
    body: '주로 몇 시에 활동했는지, 프로젝트가 어떤 흐름으로 진행됐는지, 막판에 몰아서 작업한 사람은 누구인지 그래프와 함께 풀어서 알려줘요.',
    visual: <HoursVisual />,
  },
  {
    title: '잘하는 팀의 협업 방식을 그대로',
    body: '브랜치 이름과 커밋 메시지 규칙, PR과 이슈를 쓰는 방식을 읽어요. 마음에 드는 팀의 방식은 팀 규칙 문서로 복사해서 우리 팀에 바로 가져올 수 있어요.',
    visual: <TeamworkVisual />,
  },
  {
    title: '분석은 내 작업에 차곡차곡',
    body: '로그인하면 분석한 채팅이 내 작업에 모여서 다른 기기에서도 이어서 볼 수 있어요. 링크 하나로 팀원에게 공유할 수도 있어요.',
    visual: <HistoryVisual />,
  },
  {
    title: 'macOS 앱에서는 더 깊이',
    body: '프로젝트 구조를 맵으로 둘러보고, CI/CD가 도는 순서와 이슈, PR 템플릿까지 한 화면에서 살펴봐요.',
    visual: <DeepVisual />,
    extra: MAC_DOWNLOAD_OPEN ? (
      <a
        href={MAC_DOWNLOAD}
        download
        onClick={() => track('app_download_click', { os: 'macos', from: 'about' })}
        className="mt-4 inline-block text-[14px] font-medium text-brand transition-colors hover:text-brand-hover"
      >
        앱 다운로드 ({MAC_SUPPORT})
      </a>
    ) : undefined,
  },
]

/** 크게 보여주지 않는 나머지 기능이에요. 백엔드의 계산 규칙과 맞춰요. */
const MORE: [string, string][] = [
  ['로그인 없이 바로', '공개 레포 링크만 있으면 가입하지 않아도 분석해요.'],
  ['궁금한 것만 골라서', '기여도 분석을 끝까지 보지 않아도 질문을 골라 바로 답을 받아요.'],
  ['사람이 쓴 코드만', '원하면 lock 파일과 빌드 결과물을 빼고 줄 수를 계산해요.'],
  ['봇과 병합 커밋은 빼고', '사람이 한 일만 남도록 자동으로 생긴 커밋은 세지 않아요.'],
  ['이메일이 달라도 한 사람', '여러 이메일로 커밋했어도 GitHub 계정 기준으로 합쳐요.'],
  ['참여자가 많아도', '다섯 명이 넘으면 자세히 살펴볼 사람을 골라서 봐요.'],
  ['특정 참여자만 자세히', '한 사람의 수치와 활동 시간, 맡은 기능을 따로 볼 수 있어요.'],
  ['공개 레포만', '비공개 레포의 내용은 읽지 않아요.'],
]

/** 서비스에 어떤 기능이 있는지 하나씩 보여주는 소개 화면이에요. 스크롤하면 기능이 차례로 떠올라요. */
export function About({ onHome, onArticles }: Props) {
  const scrollRef = useRef<HTMLElement>(null)

  useEffect(() => {
    document.title = `소개 | ${SITE_TITLE}`
    return () => {
      document.title = SITE_TITLE
    }
  }, [])

  // 화면에 들어온 덩어리부터 보여줘요. 처음부터 보이는 것은 그리기 전에 바로 표시해서 깜빡이지 않게 해요.
  useLayoutEffect(() => {
    const root = scrollRef.current
    if (!root) return
    const targets = [...root.querySelectorAll<HTMLElement>('[data-reveal]')]
    if (!('IntersectionObserver' in window)) return
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
      { root, rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
    )
    targets.filter((target) => target.dataset.shown === undefined).forEach((target) => observer.observe(target))
    return () => observer.disconnect()
  }, [])

  const start = (from: string) => () => {
    track('about_cta_click', { from })
    onHome()
  }

  return (
    <main ref={scrollRef} className="flex-1 overflow-x-hidden overflow-y-auto">
      <section className="mx-auto flex min-h-[78dvh] w-full max-w-3xl flex-col items-center justify-center px-5 pt-24 pb-10 text-center">
        <h1 className="animate-word text-balance break-keep text-[26px] font-semibold leading-snug text-gray-900 sm:text-[30px]">
          링크 하나로 알아보는, 우리 팀이 일한 방식
        </h1>
        <p className="mt-4 max-w-xl animate-rise text-balance break-keep text-[14px] leading-relaxed text-gray-500 sm:text-[15px]" style={{ animationDelay: '200ms' }}>
          WhoIsLoafing은 GitHub 레포 링크를 받아서 누가 얼마나, 무엇을, 어떻게 만들었는지 대화로 풀어 드려요. 아래로 내려가며 무엇을 할 수 있는지 살펴보세요.
        </p>
        <div className="mt-7 flex animate-rise flex-wrap justify-center gap-2" style={{ animationDelay: '320ms' }}>
          <InnerLink href="/" onNavigate={start('top')} className={primaryButton}>
            레포 분석하러 가기
          </InnerLink>
          <InnerLink href="/articles" onNavigate={onArticles} className={quietButton}>
            아티클 읽기
          </InnerLink>
        </div>
      </section>

      <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
        {FEATURES.map((feature, index) => (
          <section key={feature.title} className="grid items-center gap-8 py-14 md:grid-cols-2 md:gap-16 md:py-28">
            <div data-reveal className={index % 2 === 1 ? 'md:order-2' : ''}>
              <h2 className="text-balance break-keep text-[24px] font-semibold leading-snug text-gray-900 sm:text-[30px]">{feature.title}</h2>
              <p className="mt-4 break-keep text-[15px] leading-relaxed text-gray-500">{feature.body}</p>
              {feature.extra}
            </div>
            <div data-reveal style={delay(120)} aria-hidden>
              {feature.visual}
            </div>
          </section>
        ))}
        <p data-reveal className="text-center text-[12px] text-gray-400">
          그림 속의 팀과 숫자는 이해를 돕기 위한 예시예요.
        </p>

        <section className="py-20 md:py-28">
          <h2 data-reveal className="text-center text-[24px] font-semibold leading-snug text-gray-900 sm:text-[30px]">
            그리고 이런 것도
          </h2>
          <ul className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {MORE.map(([title, body], index) => (
              <li key={title} data-reveal style={delay((index % 4) * 90)} className="border-t border-gray-200 pt-4">
                <h3 className="text-[15px] font-semibold text-gray-900">{title}</h3>
                <p className="mt-1.5 break-keep text-[13.5px] leading-relaxed text-gray-500">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section data-reveal className="mx-auto mb-10 max-w-2xl rounded-3xl bg-brand-soft px-6 py-10 text-center">
          <h2 className="text-[20px] font-semibold text-gray-900 sm:text-[22px]">우리 프로젝트의 MVP가 궁금한가요?</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-gray-600">공개 레포 링크만 넣으면 로그인 없이 바로 분석해 드려요.</p>
          <InnerLink href="/" onNavigate={start('bottom')} className={`${primaryButton} mt-6`}>
            레포 분석하러 가기
          </InnerLink>
        </section>

        <p className="pb-16 text-center text-[13px] leading-relaxed text-gray-500">
          WhoIsLoafing은{' '}
          <a
            href="https://hidly.dev/"
            target="_blank"
            rel="noreferrer"
            onClick={() => track('team_link_click', { from: 'about' })}
            className="font-medium text-brand transition-colors hover:text-brand-hover"
          >
            숨은빚청년들 팀
          </a>
          이 만들어요.
        </p>
      </div>
    </main>
  )
}
