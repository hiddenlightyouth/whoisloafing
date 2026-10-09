import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const start = () =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )

// 아티클 주소로 들어오면 미리 그려 둔 글이 이미 화면에 있어요. 아티클 코드를 먼저 받은 뒤에 그려서, 글이 잠깐 사라졌다 나타나지 않게 해요.
if (/^\/articles(\/|$)/.test(window.location.pathname)) void import('./components/Articles').finally(start)
else start()
