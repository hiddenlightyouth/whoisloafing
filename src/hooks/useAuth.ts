import { useCallback, useEffect, useState } from 'react'
import type { SessionUser } from '../../shared/types'
import { fetchUser, logout as requestLogout } from '../lib/api'

export function useAuth() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    fetchUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setReady(true))
  }, [])

  const logout = useCallback(async () => {
    await requestLogout().catch(() => {})
    setUser(null)
  }, [])

  return { user, ready, logout }
}
