/**
 * 소개 화면과 아티클 화면을 빌드할 때 미리 HTML로 그려 둬요. 검색 로봇과 링크 미리보기는 자바스크립트를 돌리지 않고도 글을 읽을 수 있어요.
 * scripts/prerender.mjs가 이 파일의 빌드 결과를 불러서 dist에 페이지별 HTML 파일을 만들어요.
 */
import { renderToString } from 'react-dom/server'
import type { ReactNode } from 'react'
import { About } from './components/About'
import { Articles } from './components/Articles'
import { Header } from './components/Header'
import { articles } from './lib/articles'

export interface PrerenderedPage {
  /** 화면 주소. 파일은 이 주소에 .html을 붙여서 만들어요. */
  path: string
  title: string
  description: string
  html: string
}

const noop = () => {}
const never = async () => false

function render(screen: ReactNode): string {
  return renderToString(
    // App의 바깥 틀과 같은 모양이에요. 자바스크립트가 뜨기 전과 뒤의 화면이 달라 보이지 않게 맞춰요.
    <div className="relative flex h-dvh flex-col bg-white">
      <Header
        onHome={noop}
        inChat={false}
        storage={false}
        busy={false}
        onStop={noop}
        shared={false}
        onShare={never}
        onCopyLink={never}
        onLoginToShare={noop}
        onAbout={noop}
        onArticles={noop}
        onAccount={noop}
      />
      {screen}
    </div>,
  )
}

const articlesScreen = (slug: string | null) => <Articles slug={slug} onOpen={noop} onHome={noop} />

export const pages: PrerenderedPage[] = [
  {
    path: '/about',
    title: '소개 | WhoIsLoafing',
    description: 'GitHub 레포 링크 하나로 누가 얼마나, 무엇을, 어떻게 만들었는지 읽어 드려요. 기여도와 맡은 기능, 협업 방식을 대화로 풀어 줘요.',
    html: render(<About onHome={noop} onArticles={noop} />),
  },
  {
    path: '/articles',
    title: '아티클 | WhoIsLoafing',
    description: '레포를 읽는 방법, 함께 일하는 방법, 그리고 내가 한 일을 보여주는 방법을 이야기해요.',
    html: render(articlesScreen(null)),
  },
  ...articles.map((article) => ({
    path: `/articles/${article.slug}`,
    title: `${article.title} | WhoIsLoafing`,
    description: article.description,
    html: render(articlesScreen(article.slug)),
  })),
]
