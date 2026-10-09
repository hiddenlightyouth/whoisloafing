import { useEffect, useRef } from 'react'
import { articles, findArticle, type Article } from '../lib/articles'
import { track } from '../lib/analytics'

interface Props {
  /** 보고 있는 아티클. null이면 목록을 보여줘요. */
  slug: string | null
  onOpen: (slug: string | null) => void
  onHome: () => void
}

const SITE_TITLE = 'WhoIsLoafing'

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
      href={href}
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
  return (
    <>
      <h1 className="text-[24px] font-semibold leading-snug text-gray-900 sm:text-[30px]">아티클</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-gray-500">
        레포를 읽는 방법, 함께 일하는 방법, 그리고 내가 한 일을 보여주는 방법을 이야기해요.
      </p>
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
    </>
  )
}

function ArticleView({ article, onOpen, onHome }: { article: Article } & Pick<Props, 'onOpen' | 'onHome'>) {
  const next = articles[(articles.indexOf(article) + 1) % articles.length]

  return (
    <>
      <InnerLink
        href="/articles"
        onNavigate={() => onOpen(null)}
        className="text-[13px] font-medium text-gray-400 transition-colors hover:text-gray-700"
      >
        아티클 목록
      </InnerLink>
      <h1 className="mt-5 text-balance text-[26px] font-semibold leading-snug text-gray-900 sm:text-[32px]">{article.title}</h1>

      {/* 저장소에 있는 마크다운만 그려요. 사용자가 입력한 글은 여기로 들어오지 않아요. */}
      <div className="article mt-9" dangerouslySetInnerHTML={{ __html: article.html }} />

      <div className="mt-14 rounded-2xl bg-brand-soft px-6 py-7 text-center">
        <p className="text-[16px] font-semibold text-gray-900">궁금한 레포가 떠올랐나요?</p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-gray-600">공개 레포 링크만 넣으면 로그인 없이 바로 분석해 드려요.</p>
        <InnerLink
          href="/"
          onNavigate={() => {
            track('article_cta_click', { slug: article.slug })
            onHome()
          }}
          className="mt-5 inline-flex h-10 items-center rounded-full bg-brand px-5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover"
        >
          레포 분석하러 가기
        </InnerLink>
      </div>

      {next !== article && (
        <InnerLink
          href={`/articles/${next.slug}`}
          onNavigate={() => onOpen(next.slug)}
          className="group mt-4 block rounded-2xl border border-gray-200 px-6 py-5"
        >
          <p className="text-xs text-gray-400">다음 글</p>
          <p className="mt-1.5 text-[15px] font-semibold leading-snug text-gray-900 transition-colors group-hover:text-brand">
            {next.title}
          </p>
        </InnerLink>
      )}
    </>
  )
}

export function Articles({ slug, onOpen, onHome }: Props) {
  const article = slug ? findArticle(slug) : null
  const scrollRef = useRef<HTMLElement>(null)

  // 다른 글로 넘어가면 맨 위에서부터 읽게 하고, 탭 제목도 글 제목으로 바꿔요.
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0)
    document.title = article ? `${article.title} | ${SITE_TITLE}` : `아티클 | ${SITE_TITLE}`
    return () => {
      document.title = SITE_TITLE
    }
  }, [article])

  return (
    <main ref={scrollRef} className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-5 pt-24 pb-20 sm:pt-28">
        {article ? (
          <ArticleView article={article} onOpen={onOpen} onHome={onHome} />
        ) : slug ? (
          <div className="py-20 text-center">
            <p className="text-[15px] text-gray-600">찾을 수 없는 글이에요.</p>
            <InnerLink
              href="/articles"
              onNavigate={() => onOpen(null)}
              className="mt-4 inline-flex h-10 items-center rounded-full bg-brand px-5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              아티클 목록으로
            </InnerLink>
          </div>
        ) : (
          <ArticleList onOpen={onOpen} />
        )}
      </div>
    </main>
  )
}
