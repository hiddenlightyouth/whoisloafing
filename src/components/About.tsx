import { useEffect, type MouseEvent, type ReactNode } from 'react'
import { track } from '../lib/analytics'
import { MAC_DOWNLOAD, MAC_DOWNLOAD_OPEN, MAC_SUPPORT } from '../lib/app'

interface Props {
  onHome: () => void
  onArticles: () => void
}

const SITE_TITLE = 'WhoIsLoafing'

/** 링크 하나를 넣은 뒤에 일어나는 일이에요. */
const STEPS: [string, string][] = [
  ['링크를 넣어요', '분석하고 싶은 공개 레포의 GitHub 링크를 붙여 넣어요. 가입이나 로그인은 하지 않아도 돼요.'],
  ['무엇을 볼지 골라요', '어떤 레포인지 한 문장으로 소개받은 다음, 기여도 분석부터 볼지 궁금한 질문부터 볼지 골라요.'],
  ['대화로 읽어요', '결과가 채팅 말풍선으로 하나씩 올라와요. 숫자만 늘어놓지 않고, 그 숫자가 무슨 뜻인지 풀어서 알려드려요.'],
]

/** 알려드리는 것들이에요. 서비스에 실제로 있는 기능만 적어요. 기능이 바뀌면 같이 고쳐요. */
const FEATURES: [string, string][] = [
  ['어떤 프로젝트인지', 'README와 폴더 구조, 의존성 파일을 읽고 어떤 서비스인지 한 문장으로 정리해요. 기술 스택은 언어, 프레임워크, 데이터베이스, 배포 도구로 나눠서 보여줘요.'],
  ['누가 얼마나 기여했는지', '참여자마다 커밋 수와 고친 줄 수를 세고, 기여도를 커밋 기준과 줄 수 기준 두 가지로 보여줘요. 한쪽 숫자만으로 줄 세우지 않아요.'],
  ['누가 무엇을 만들었는지', '커밋 내용을 읽고 참여자가 맡은 기능을 목록으로 정리해요. 코드를 어떤 스타일로 쓰는 사람인지도 함께 알려줘요.'],
  ['팀이 언제, 어떻게 움직였는지', '주로 몇 시에 활동했는지, 프로젝트가 어떤 흐름으로 진행됐는지, 막판에 몰아서 작업한 사람은 누구인지 그래프와 함께 보여줘요.'],
  ['어떻게 협업했는지', '브랜치 이름과 커밋 메시지 규칙, PR과 이슈를 쓰는 방식을 읽어요. 마음에 드는 팀의 방식은 팀 규칙 문서로 복사해서 우리 팀에 바로 가져올 수 있어요.'],
]

/** 숫자를 어떻게 세는지예요. 백엔드의 계산 규칙과 맞춰요. */
const RULES: string[] = [
  '병합 커밋과 봇 계정은 세지 않아요.',
  '한 사람이 여러 이메일로 커밋했어도 GitHub 계정 기준으로 합쳐요.',
  '원하면 lock 파일과 빌드 결과물처럼 사람이 직접 쓰지 않은 파일을 빼고 계산해요.',
  '공개 레포만 분석해요. 비공개 레포의 내용은 읽지 않아요.',
]

/** 예시 화면에 넣는 가짜 팀이에요. 실제 레포의 결과가 아니에요. */
const SAMPLE_PEOPLE: [string, number][] = [
  ['민지', 46],
  ['도윤', 33],
  ['서연', 21],
]

const heading = 'text-[19px] font-semibold leading-snug text-gray-900 sm:text-[21px]'
const lead = 'mt-2.5 text-[14px] leading-relaxed break-keep text-gray-500'
const primaryButton = 'inline-flex h-10 items-center rounded-full bg-brand px-5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover'
const quietButton = 'inline-flex h-10 items-center rounded-full bg-gray-100 px-5 text-[14px] font-medium text-gray-700 transition-colors hover:text-brand'

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

/** 분석 결과가 채팅으로 올라오는 모습을 작게 흉내 낸 그림이에요. 실제 말풍선과 같은 색과 모양을 써요. */
function SampleChat() {
  const bubble = 'max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed'
  return (
    <figure className="mt-10">
      <div aria-hidden className="flex flex-col gap-2.5 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
        <p className={`${bubble} ml-auto rounded-br-md bg-brand text-white`}>github.com/our-team/project</p>
        <p className={`${bubble} rounded-bl-md bg-gray-100 text-gray-900`}>
          동아리 행사 신청을 받는 웹 서비스의 <strong className="font-semibold">프론트엔드 레포</strong>네요.
        </p>
        <p className={`${bubble} rounded-bl-md bg-gray-100 text-gray-900`}>
          <strong className="font-semibold">3명이 함께한 프로젝트</strong>예요. 커밋은 민지 님이 가장 많지만, 고친 줄 수는 도윤 님과 큰 차이가 없어요.
        </p>
        <div className={`${bubble} w-full rounded-bl-md bg-gray-100 text-gray-900 sm:w-[85%]`}>
          <p className="text-[13px] font-semibold">커밋 수 기준 기여도</p>
          <ul className="mt-2.5 space-y-2">
            {SAMPLE_PEOPLE.map(([name, percent]) => (
              <li key={name} className="flex items-center gap-3 text-[13px]">
                <span className="w-8 shrink-0 text-gray-600">{name}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-white">
                  <span className="block h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
                </span>
                <span className="w-9 shrink-0 text-right text-gray-500 tabular-nums">{percent}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <figcaption className="mt-2.5 text-center text-[12px] text-gray-400">이해를 돕기 위한 예시 화면이에요.</figcaption>
    </figure>
  )
}

/** 서비스가 무엇을 해 주는지 알려 주는 소개 화면이에요. 헤더의 소개 링크로 들어와요. */
export function About({ onHome, onArticles }: Props) {
  useEffect(() => {
    document.title = `소개 | ${SITE_TITLE}`
    return () => {
      document.title = SITE_TITLE
    }
  }, [])

  const start = (from: string) => () => {
    track('about_cta_click', { from })
    onHome()
  }

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-5 pt-24 pb-20 sm:pt-28">
        <h1 className="text-balance break-keep text-[24px] font-semibold leading-snug text-gray-900 sm:text-[30px]">
          링크 하나로 알아보는, 우리 팀이 일한 방식
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed break-keep text-gray-500 sm:text-[15px]">
          WhoIsLoafing은 GitHub 레포 링크를 받아서 누가 얼마나, 무엇을, 어떻게 만들었는지 읽어 드리는 서비스예요. 팀 프로젝트를 돌아볼 때, 포트폴리오에 내 몫을 적을 때,
          잘하는 팀의 협업 방식이 궁금할 때 써 보세요.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <InnerLink href="/" onNavigate={start('top')} className={primaryButton}>
            레포 분석하러 가기
          </InnerLink>
          <InnerLink href="/articles" onNavigate={onArticles} className={quietButton}>
            아티클 읽기
          </InnerLink>
        </div>

        <SampleChat />

        <section className="mt-16">
          <h2 className={heading}>이렇게 써요</h2>
          <ol className="mt-6 space-y-6">
            {STEPS.map(([title, body], index) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-semibold text-brand-hover tabular-nums">
                  {index + 1}
                </span>
                <div className="min-w-0 pt-0.5">
                  <h3 className="text-[15px] font-semibold text-gray-900">{title}</h3>
                  <p className="mt-1 text-[14px] leading-relaxed break-keep text-gray-500">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-16">
          <h2 className={heading}>이런 것을 알려드려요</h2>
          <p className={lead}>기여도 분석을 끝까지 보지 않아도, 궁금한 질문만 골라서 바로 볼 수 있어요.</p>
          <ul className="mt-6 border-t border-gray-100">
            {FEATURES.map(([title, body]) => (
              <li key={title} className="border-b border-gray-100 py-5">
                <h3 className="text-[15px] font-semibold text-gray-900">{title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed break-keep text-gray-500">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16">
          <h2 className={heading}>숫자는 이렇게 세요</h2>
          <p className={lead}>누가 덜 했다고 말하기 전에, 세는 방법부터 공정해야 한다고 생각해요.</p>
          <ul className="mt-5 space-y-2.5">
            {RULES.map((rule) => (
              <li key={rule} className="flex gap-3 text-[14px] leading-relaxed break-keep text-gray-700">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-[5px] size-3.5 shrink-0 text-brand" aria-hidden="true">
                  <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {rule}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-[13px] leading-relaxed break-keep text-gray-500">
            기여도는 커밋과 코드로만 보이는 일부예요. 기획, 디자인, 회의처럼 레포에 남지 않는 일은 담기지 않으니, 사람을 평가하는 근거보다는 대화를 시작하는 자료로 써 주세요.
          </p>
        </section>

        <section className="mt-16">
          <h2 className={heading}>더 깊이 쓰고 싶다면</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            <li className="rounded-2xl border border-gray-200 p-5">
              <h3 className="text-[15px] font-semibold text-gray-900">로그인하면</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed break-keep text-gray-500">
                분석한 채팅이 내 작업에 모여서 다른 기기에서도 이어서 볼 수 있어요. 링크로 팀원에게 공유할 수도 있어요.
              </p>
            </li>
            <li className="rounded-2xl border border-gray-200 p-5">
              <h3 className="text-[15px] font-semibold text-gray-900">macOS 앱에서는</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed break-keep text-gray-500">
                프로젝트 구조를 맵으로 둘러보고, CI/CD가 도는 순서와 이슈, PR 템플릿까지 한 화면에서 살펴봐요.
              </p>
              {MAC_DOWNLOAD_OPEN && (
                <a
                  href={MAC_DOWNLOAD}
                  download
                  onClick={() => track('app_download_click', { os: 'macos', from: 'about' })}
                  className="mt-3 inline-block text-[13px] font-medium text-brand transition-colors hover:text-brand-hover"
                >
                  앱 다운로드 ({MAC_SUPPORT})
                </a>
              )}
            </li>
          </ul>
        </section>

        <section className="mt-16">
          <h2 className={heading}>만든 사람들</h2>
          <p className={lead}>
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
            이 만들어요. 팀 프로젝트가 끝난 뒤에 누가 무엇을 했는지 서로 편하게 이야기할 수 있으면 좋겠다는 마음에서 시작했어요.
          </p>
        </section>

        <div className="mt-16 rounded-2xl bg-brand-soft px-6 py-7 text-center">
          <p className="text-[16px] font-semibold text-gray-900">우리 프로젝트의 MVP가 궁금한가요?</p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-gray-600">공개 레포 링크만 넣으면 로그인 없이 바로 분석해 드려요.</p>
          <InnerLink href="/" onNavigate={start('bottom')} className={`${primaryButton} mt-5`}>
            레포 분석하러 가기
          </InnerLink>
        </div>
      </div>
    </main>
  )
}
