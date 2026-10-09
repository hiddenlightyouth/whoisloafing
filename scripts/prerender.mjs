// 빌드한 프론트엔드(dist)에 아티클 화면을 페이지별 HTML 파일로 추가하고, 사이트맵을 만들어요.
// npm run build의 마지막 단계에서 실행돼요.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const ssrDir = path.join(root, 'dist-ssr')
const SITE = 'https://whoisloafing.hidly.dev'

const escapeHtml = (text) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

/** 태그 하나의 속성 값을 바꿔요. 못 찾으면 빌드를 멈춰서, index.html이 바뀌었을 때 바로 알 수 있게 해요. */
function replaceOnce(html, pattern, replacement) {
  if (!pattern.test(html)) throw new Error(`index.html에서 바꿀 곳을 찾지 못했어요: ${pattern}`)
  return html.replace(pattern, replacement)
}

const { pages } = await import(pathToFileURL(path.join(ssrDir, 'prerender.js')).href)
const template = await readFile(path.join(dist, 'index.html'), 'utf8')

for (const page of pages) {
  const title = escapeHtml(page.title)
  const description = escapeHtml(page.description)
  const url = SITE + page.path
  let html = template
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${title}</title>`)
  html = replaceOnce(html, /(<meta name="description" content=")[^"]*"/, `$1${description}"`)
  html = replaceOnce(html, /(<link rel="canonical" href=")[^"]*"/, `$1${url}"`)
  html = replaceOnce(html, /(<meta property="og:type" content=")[^"]*"/, `$1${page.path === '/articles' ? 'website' : 'article'}"`)
  html = replaceOnce(html, /(<meta property="og:title" content=")[^"]*"/, `$1${title}"`)
  html = replaceOnce(html, /(<meta property="og:description" content=")[^"]*"/, `$1${description}"`)
  html = replaceOnce(html, /(<meta property="og:url" content=")[^"]*"/, `$1${url}"`)
  html = replaceOnce(html, /(<meta name="twitter:title" content=")[^"]*"/, `$1${title}"`)
  html = replaceOnce(html, /(<meta name="twitter:description" content=")[^"]*"/, `$1${description}"`)
  html = replaceOnce(html, /<div id="root"><\/div>/, () => `<div id="root">${page.html}</div>`)

  const file = path.join(dist, `${page.path.slice(1)}.html`)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, html)
}

const urls = ['/', ...pages.map((page) => page.path)].map((p) => `  <url>\n    <loc>${SITE}${p}</loc>\n  </url>`)
await writeFile(
  path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
)

await rm(ssrDir, { recursive: true, force: true })
console.log(`아티클 화면 ${pages.length}개와 사이트맵을 만들었어요.`)
