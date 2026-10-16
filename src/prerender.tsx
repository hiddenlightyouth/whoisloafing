/**
 * 소개 화면과 아티클 화면을 빌드할 때 미리 HTML로 그려 둬요. 검색 로봇과 링크 미리보기는 자바스크립트를 돌리지 않고도 글을 읽을 수 있어요.
 * 한국어 화면은 원래 주소에, 영어 화면은 /en으로 시작하는 주소에 만들어요. 영어 메인 화면(/en)은 미리보기 태그만 바꿔요.
 * scripts/prerender.mjs가 이 파일의 빌드 결과를 불러서 dist에 페이지별 HTML 파일을 만들어요.
 */
import { renderToString } from 'react-dom/server'
import type { ReactNode } from 'react'
import { About, ABOUT_TEXT } from './components/About'
import { Articles, ARTICLES_TEXT } from './components/Articles'
import { Header } from './components/Header'
import { articlesFor } from './lib/articles'
import { localizePath, setLang, LANGS, type Lang } from './lib/i18n'
import { HOME_META, OG_IMAGES, OG_LOCALES, SITE_TITLE } from './lib/meta'

export interface PrerenderedPage {
  /** 화면 주소. 파일은 이 주소에 .html을 붙여서 만들어요. */
  path: string
  lang: Lang
  /** og:locale 값 */
  locale: string
  /** 미리보기 카드의 대표 이미지 주소 */
  image: string
  title: string
  description: string
  /** 미리보기 카드의 제목과 설명. 없으면 title, description을 써요. */
  ogTitle?: string
  ogDescription?: string
  /** 언어마다의 같은 화면 주소. hreflang 링크로 적어요. */
  alternates: Record<Lang, string>
  /** 미리 그린 화면. 없으면 화면은 그리지 않고 태그만 바꿔요. */
  html?: string
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

function pagesFor(lang: Lang): PrerenderedPage[] {
  setLang(lang, { persist: false })
  const base = (path: string) => ({
    path: localizePath(path, lang),
    lang,
    locale: OG_LOCALES[lang],
    image: OG_IMAGES[lang],
    alternates: { ko: localizePath(path, 'ko'), en: localizePath(path, 'en') },
  })
  const home = HOME_META[lang]
  return [
    // 한국어 메인 화면은 index.html 그대로예요.
    ...(lang === 'en' ? [{ ...base('/'), ...home }] : []),
    {
      ...base('/about'),
      title: `${ABOUT_TEXT[lang].pageTitle} | ${SITE_TITLE}`,
      description: ABOUT_TEXT[lang].metaDescription,
      html: render(<About onHome={noop} />),
    },
    {
      ...base('/articles'),
      title: `${ARTICLES_TEXT[lang].title} | ${SITE_TITLE}`,
      description: ARTICLES_TEXT[lang].description,
      html: render(articlesScreen(null)),
    },
    ...articlesFor(lang).map((article) => ({
      ...base(`/articles/${article.slug}`),
      title: `${article.title} | ${SITE_TITLE}`,
      description: article.description,
      html: render(articlesScreen(article.slug)),
    })),
  ]
}

export const pages: PrerenderedPage[] = LANGS.flatMap(pagesFor)
