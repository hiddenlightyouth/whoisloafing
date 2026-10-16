import { useEffect, useRef } from 'react'
import { articlesFor, findArticle, type Article } from '../lib/articles'
import { track } from '../lib/analytics'
import { localizePath, messages, useLang, useMessages } from '../lib/i18n'
import { applyMeta, HOME_META, SITE_TITLE } from '../lib/meta'

interface Props {
  /** 보고 있는 아티클. null이면 목록을 보여줘요. */
  slug: string | null
  onOpen: (slug: string | null) => void
  onHome: () => void
}

export const ARTICLES_TEXT = messages({
  ko: {
    title: '아티클',
    description: '레포를 읽는 방법, 함께 일하는 방법, 그리고 내가 한 일을 보여주는 방법을 이야기해요.',
    teamBefore: '이 서비스를 어떻게 만들었는지는 ',
    teamLink: '숨은빚청년들 팀의 개발 기록',
    teamAfter: '에서 볼 수 있어요.',
    list: '아티클 목록',
    ctaTitle: '궁금한 레포가 떠올랐나요?',
    ctaBody: '공개 레포 링크만 넣으면 로그인 없이 바로 분석해 드려요.',
    cta: '레포 분석하러 가기',
    next: '다음 글',
    missing: '찾을 수 없는 글이에요.',
    backToList: '아티클 목록으로',
  },
  en: {
    title: 'Articles',
    description: 'Notes on reading repositories, working as a team, and showing the work you actually did.',
    teamBefore: 'Curious how this service was built? Read the ',
    teamLink: 'development notes from the Hidly team',
    teamAfter: ' (in Korean).',
    list: 'All articles',
    ctaTitle: 'Have a repo in mind?',
    ctaBody: 'Paste any public repository link and get an analysis right away, no sign-in needed.',
    cta: 'Analyze a repo',
    next: 'Next article',
    missing: "We couldn't find this article.",
    backToList: 'Back to articles',
  },
})

/** 같은 페이지 안에서 화면만 바꾸는 링크. 새 탭으로 열기 같은 브라우저 기본 동작은 그대로 둬요. */
function InnerLink({
  href,
  onNavigate,
  className,
  children,
}: {
  href: string
  onNavigate: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <a
      href={localizePath(href)}
      onClick={(event) => {
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

function ArticleList({ onOpen }: Pick<Props, 'onOpen'>) {
  const text = useMessages(ARTICLES_TEXT)
  const articles = articlesFor(useLang())
  return (
    <>
      <h1 className="text-[24px] font-semibold leading-snug text-gray-900 sm:text-[30px]">{text.title}</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-gray-500">{text.description}</p>
      <ul className="mt-8 border-t border-gray-100">
        {articles.map((article) => (
          <li key={article.slug} className="border-b border-gray-100">
            <InnerLink href={`/articles/${article.slug}`} onNavigate={() => onOpen(article.slug)} className="group block py-6">
              <h2 className="text-[17px] font-semibold leading-snug text-gray-900 transition-colors group-hover:text-brand sm:text-[18px]">
                {article.title}
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-gray-500">{article.description}</p>
            </InnerLink>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-[13px] leading-relaxed text-gray-500">
        {text.teamBefore}
        <a
          href="https://hidly.dev/articles/"
          target="_blank"
          rel="noreferrer"
          onClick={() => track('team_articles_click')}
          className="font-medium text-brand transition-colors hover:text-brand-hover"
        >
          {text.teamLink}
        </a>
        {text.teamAfter}
      </p>
    </>
  )
}

function ArticleView({ article, onOpen, onHome }: { article: Article } & Pick<Props, 'onOpen' | 'onHome'>) {
  const text = useMessages(ARTICLES_TEXT)
  const articles = articlesFor(useLang())
  const next = articles[(articles.indexOf(article) + 1) % articles.length]

  return (
    <>
      <InnerLink
        href="/articles"
        onNavigate={() => onOpen(null)}
        className="text-[13px] font-medium text-gray-400 transition-colors hover:text-gray-700"
      >
        {text.list}
      </InnerLink>
      <h1 className="mt-5 text-balance text-[26px] font-semibold leading-snug text-gray-900 sm:text-[32px]">{article.title}</h1>

      {/* 저장소에 있는 마크다운만 그려요. 사용자가 입력한 글은 여기로 들어오지 않아요. */}
      <div className="article mt-9" dangerouslySetInnerHTML={{ __html: article.html }} />

      <div className="mt-14 rounded-2xl bg-brand-soft px-6 py-7 text-center">
        <p className="text-[16px] font-semibold text-gray-900">{text.ctaTitle}</p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-gray-600">{text.ctaBody}</p>
        <InnerLink
          href="/"
          onNavigate={() => {
            track('article_cta_click', { slug: article.slug })
            onHome()
          }}
          className="mt-5 inline-flex h-10 items-center rounded-full bg-brand px-5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover"
        >
          {text.cta}
        </InnerLink>
      </div>

      {next !== article && (
        <InnerLink
          href={`/articles/${next.slug}`}
          onNavigate={() => onOpen(next.slug)}
          className="group mt-4 block rounded-2xl border border-gray-200 px-6 py-5"
        >
          <p className="text-xs text-gray-400">{text.next}</p>
          <p className="mt-1.5 text-[15px] font-semibold leading-snug text-gray-900 transition-colors group-hover:text-brand">
            {next.title}
          </p>
        </InnerLink>
      )}
    </>
  )
}

export function Articles({ slug, onOpen, onHome }: Props) {
  const lang = useLang()
  const text = useMessages(ARTICLES_TEXT)
  const article = slug ? findArticle(slug, lang) : null
  const scrollRef = useRef<HTMLElement>(null)

  // 다른 글로 넘어가면 맨 위에서부터 읽게 해요.
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0)
  }, [slug])

  // 탭 제목과 미리보기 태그를 글에 맞게 바꾸고, 나가면 메인 화면의 값으로 돌려놔요.
  useEffect(() => {
    applyMeta(
      article
        ? { title: `${article.title} | ${SITE_TITLE}`, description: article.description }
        : { title: `${ARTICLES_TEXT[lang].title} | ${SITE_TITLE}`, description: ARTICLES_TEXT[lang].description },
      lang,
      article ? `/articles/${article.slug}` : '/articles',
    )
    return () => applyMeta(HOME_META[lang], lang, '/')
  }, [article, lang])

  return (
    <main ref={scrollRef} className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-5 pt-24 pb-20 sm:pt-28">
        {article ? (
          <ArticleView article={article} onOpen={onOpen} onHome={onHome} />
        ) : slug ? (
          <div className="py-20 text-center">
            <p className="text-[15px] text-gray-600">{text.missing}</p>
            <InnerLink
              href="/articles"
              onNavigate={() => onOpen(null)}
              className="mt-4 inline-flex h-10 items-center rounded-full bg-brand px-5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              {text.backToList}
            </InnerLink>
          </div>
        ) : (
          <ArticleList onOpen={onOpen} />
        )}
      </div>
    </main>
  )
}
