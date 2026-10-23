// 빌드한 프론트엔드(dist)에 소개 화면과 아티클 화면을 언어별, 페이지별 HTML 파일로 추가하고, 사이트맵을 만들어요.
// npm run build의 마지막 단계에서 실행돼요.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const ssrDir = path.join(root, 'dist-ssr')
const SITE = 'https://lofy.hidly.dev'

const escapeHtml = (text) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

/** 태그 하나의 속성 값을 바꿔요. 못 찾으면 빌드를 멈춰서, index.html이 바뀌었을 때 바로 알 수 있게 해요. */
function replaceOnce(html, pattern, replacement) {
  if (!pattern.test(html)) throw new Error(`index.html에서 바꿀 곳을 찾지 못했어요: ${pattern}`)
  return html.replace(pattern, replacement)
}

const SHELL_GUARD =
  '<script>if(location.pathname!=="/"||/WhoIsLoafingApp\\//.test(navigator.userAgent))document.documentElement.dataset.shell=""</script>' +
  '<style>html[data-shell] #root{display:none}</style>'

const { pages } = await import(pathToFileURL(path.join(ssrDir, 'prerender.js')).href)
const template = await readFile(path.join(dist, 'index.html'), 'utf8')

/** 같은 화면의 다른 언어 주소를 알려주는 링크. 검색 로봇이 언어에 맞는 주소를 보여줘요. */
const alternateLinks = (alternates) =>
  [
    ...Object.entries(alternates).map(([lang, p]) => `<link rel="alternate" hreflang="${lang}" href="${SITE}${p}" />`),
    `<link rel="alternate" hreflang="x-default" href="${SITE}${alternates.ko}" />`,
  ].join('\n    ')

for (const page of pages) {
  const title = escapeHtml(page.title)
  const description = escapeHtml(page.description)
  const ogTitle = escapeHtml(page.ogTitle ?? page.title)
  const ogDescription = escapeHtml(page.ogDescription ?? page.description)
  const otherLocale = page.locale === 'ko_KR' ? 'en_US' : 'ko_KR'
  const url = SITE + page.path
  let html = template
  html = replaceOnce(html, /<html lang="[^"]*">/, `<html lang="${page.lang}">`)
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${title}</title>`)
  html = replaceOnce(html, /(<meta name="description" content=")[^"]*"/, `$1${description}"`)
  html = replaceOnce(html, /(<link rel="canonical" href=")[^"]*" \/>/, `$1${url}" />\n    ${alternateLinks(page.alternates)}`)
  html = replaceOnce(html, /(<meta property="og:type" content=")[^"]*"/, `$1${/\/articles\//.test(page.path) ? 'article' : 'website'}"`)
  html = replaceOnce(html, /(<meta property="og:title" content=")[^"]*"/, `$1${ogTitle}"`)
  html = replaceOnce(html, /(<meta property="og:description" content=")[^"]*"/, `$1${ogDescription}"`)
  html = replaceOnce(html, /(<meta property="og:url" content=")[^"]*"/, `$1${url}"`)
  html = replaceOnce(html, /(<meta property="og:locale" content=")[^"]*"/, `$1${page.locale}"`)
  html = replaceOnce(html, /(<meta property="og:locale:alternate" content=")[^"]*"/, `$1${otherLocale}"`)
  html = replaceOnce(html, /(<meta name="twitter:title" content=")[^"]*"/, `$1${ogTitle}"`)
  html = replaceOnce(html, /(<meta name="twitter:description" content=")[^"]*"/, `$1${ogDescription}"`)
  html = replaceOnce(html, /(<meta property="og:image" content=")[^"]*"/, `$1${page.image}"`)
  html = replaceOnce(html, /(<meta name="twitter:image" content=")[^"]*"/, `$1${page.image}"`)
  if (page.html) html = replaceOnce(html, /<div id="root"><\/div>/, () => `<div id="root">${page.html}</div>`)
  // index.html은 없는 주소(/app, /c/아이디 등)에도 대신 가는 파일이에요. 거기서는 미리 그린 소개 화면이 잠깐 비치지 않게 숨기고,
  // src/main.tsx가 그리기 전에 비워요. macOS 앱의 메인 주소는 새 분석 화면이라 앱에서도 숨겨요.
  if (page.path === '/') html = replaceOnce(html, /<\/head>/, () => `  ${SHELL_GUARD}\n  </head>`)

  const file = path.join(dist, page.path === '/' ? 'index.html' : `${page.path.slice(1)}.html`)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, html)
}

const urls = pages.map(
  (page) =>
    `  <url>\n    <loc>${SITE}${page.path}</loc>\n` +
    Object.entries(page.alternates)
      .map(([lang, p]) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${SITE}${p}" />\n`)
      .join('') +
    `  </url>`,
)
await writeFile(
  path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`,
)

await rm(ssrDir, { recursive: true, force: true })
console.log(`소개와 아티클 화면 ${pages.length}개와 사이트맵을 만들었어요.`)
