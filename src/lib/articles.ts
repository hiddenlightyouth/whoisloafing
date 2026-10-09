/**
 * 아티클은 저장소의 articles 폴더에 마크다운 파일로 보관해요. 파일을 추가하면 목록에 바로 나와요.
 * 파일 이름은 "순서-주소.md" 형식이고, 맨 위의 --- 사이에 title, description, date를 적어요.
 */
import { marked } from 'marked'

export interface Article {
  /** 주소에 쓰는 이름. 파일 이름에서 앞의 순서 숫자를 뗀 값이에요. */
  slug: string
  title: string
  description: string
  date: string
  html: string
}

const files = import.meta.glob<string>('../../articles/*.md', { query: '?raw', import: 'default', eager: true })

function parse(path: string, raw: string): Article {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw)
  const meta: Record<string, string> = {}
  for (const line of (match?.[1] ?? '').split('\n')) {
    const colon = line.indexOf(':')
    if (colon > 0) meta[line.slice(0, colon).trim()] = line.slice(colon + 1).trim()
  }
  const name = path.split('/').pop()!.replace(/\.md$/, '')
  return {
    slug: name.replace(/^\d+-/, ''),
    title: meta.title ?? name,
    description: meta.description ?? '',
    date: meta.date ?? '',
    html: marked.parse(match?.[2] ?? raw, { async: false }),
  }
}

/** 파일 이름의 순서 숫자대로 정렬한 전체 아티클 */
export const articles: Article[] = Object.keys(files)
  .sort()
  .map((path) => parse(path, files[path]))

export const findArticle = (slug: string) => articles.find((article) => article.slug === slug) ?? null

/** "2026-10-10"을 "2026년 10월 10일"로 바꿔요. */
export function formatArticleDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return year && month && day ? `${year}년 ${month}월 ${day}일` : date
}
