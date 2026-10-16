/**
 * 아티클은 저장소의 articles 폴더에 마크다운 파일로 보관해요. 파일을 추가하면 목록에 바로 나와요.
 * 파일 이름은 "순서-주소.md" 형식이고, 맨 위의 --- 사이에 title, description을 적어요.
 * 영어 글은 articles/en 폴더에 같은 파일 이름으로 둬요. 영어 글이 없는 주소는 한국어 글을 보여줘요.
 */
import { marked } from 'marked'
import type { Lang } from './i18n'

export interface Article {
  /** 주소에 쓰는 이름. 파일 이름에서 앞의 순서 숫자를 뗀 값이에요. */
  slug: string
  title: string
  description: string
  html: string
}

const files = import.meta.glob<string>('../../articles/*.md', { query: '?raw', import: 'default', eager: true })
const enFiles = import.meta.glob<string>('../../articles/en/*.md', { query: '?raw', import: 'default', eager: true })

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
    html: marked.parse(match?.[2] ?? raw, { async: false }),
  }
}

const fileName = (path: string) => path.split('/').pop()!

/** 파일 이름의 순서 숫자대로 정렬한 전체 아티클 */
const korean: Article[] = Object.keys(files)
  .sort()
  .map((path) => parse(path, files[path]))

const english: Article[] = Object.keys(files)
  .sort()
  .map((path) => {
    const translated = Object.keys(enFiles).find((en) => fileName(en) === fileName(path))
    return translated ? parse(translated, enFiles[translated]) : parse(path, files[path])
  })

/** 언어에 맞는 아티클 목록. 순서와 주소는 언어와 상관없이 같아요. */
export const articlesFor = (lang: Lang): Article[] => (lang === 'en' ? english : korean)

export const findArticle = (slug: string, lang: Lang) => articlesFor(lang).find((article) => article.slug === slug) ?? null
