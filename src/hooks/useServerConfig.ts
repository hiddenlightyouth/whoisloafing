import { useEffect, useState } from 'react'
import { fetchConfig, type ServerConfig } from '../lib/api'
import { setFeedbackReady } from '../lib/feedback'

/**
 * 서버가 지원하는 기능을 처음 한 번 물어봐요. 아직 물어보는 중이면 null이에요.
 * 화면이 서버보다 먼저 배포되어도 열리지 않는 메뉴가 나오지 않게, 켜진 기능만 보여줄 때 써요.
 */
export function useServerConfig(): ServerConfig | null {
  const [config, setConfig] = useState<ServerConfig | null>(null)

  useEffect(() => {
    void fetchConfig().then((next) => {
      setConfig(next)
      setFeedbackReady(next.feedback)
    })
  }, [])

  return config
}
