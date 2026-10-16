import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { currentPath } from './lib/i18n'
import { aboutFromPath } from './lib/routes'
import './index.css'

const RELOADED_KEY = 'whoisloafing:chunk-reloaded'
const RELOAD_GAP_MS = 10_000

// 새로 배포하면 예전 코드 조각의 주소가 사라져요. 열어 둔 화면이 그 조각을 받으려다 실패하면 화면이 하얗게 비니,
// 새 코드로 한 번 새로 고쳐요. 새로 고쳐도 또 실패하면 되풀이하지 않아요.
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_KEY)) || 0
    if (Date.now() - last < RELOAD_GAP_MS) return
    sessionStorage.setItem(RELOADED_KEY, String(Date.now()))
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})

const start = () => {
  const root = document.getElementById('root')!
  // index.html에 미리 그려 둔 소개 화면을 다른 주소에서는 숨겨 뒀어요. 그 화면을 비우고 그려요.
  if (document.documentElement.dataset.shell !== undefined) {
    root.replaceChildren()
    delete document.documentElement.dataset.shell
  }
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

// 소개(브라우저의 메인 주소)와 아티클 주소로 들어오면 미리 그려 둔 화면이 이미 있어요. 그 화면의 코드를 먼저 받은 뒤에 그려서, 글이 잠깐 사라졌다 나타나지 않게 해요.
const path = currentPath()
if (/^\/articles(\/|$)/.test(path)) void import('./components/Articles').finally(start)
else if (aboutFromPath()) void import('./components/About').finally(start)
else start()
