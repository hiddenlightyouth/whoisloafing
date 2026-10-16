import { useEffect, useState } from 'react'
import { messages, pick } from './i18n'

/**
 * IP 주소가 대략 어디인지 알려줘요. 위치는 키 없이 쓰는 공개 서비스(ipwho.is)에 물어보고,
 * 한 번 알아낸 주소는 이 기기에 적어 둬서 같은 주소를 다시 묻지 않아요.
 * 통신사가 주소를 나눠 주는 곳 기준이라 실제 위치와 다를 수 있어요.
 */
const LOOKUP_URL = 'https://ipwho.is/'
const STORAGE_KEY = 'whoisloafing:ip-places'
/** 이 기기에 적어 두는 주소 수. 넘으면 오래된 것부터 버려요. */
const STORED_LIMIT = 200
const LOCAL_PLACE_TEXT = messages({ ko: '내부 네트워크', en: 'Local network' })

const PRIVATE_V4 = /^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/
const PRIVATE_V6 = /^(?:::1$|(?:0:){7}1$|f[cd][0-9a-f]{2}:|fe[89ab][0-9a-f]:)/i

/** 집이나 회사 안에서만 쓰는 주소인지. 이런 주소는 위치를 알 수 없어서 묻지 않아요. */
function isPrivateIp(ip: string): boolean {
  const value = ip.replace(/^::ffff:/i, '')
  return PRIVATE_V4.test(value) || PRIVATE_V6.test(value)
}

function readStored(): Record<string, string> {
  try {
    return (JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, string>) ?? {}
  } catch {
    return {}
  }
}

function store(ip: string, place: string) {
  try {
    const entries = Object.entries({ ...readStored(), [ip]: place }).slice(-STORED_LIMIT)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch {
    // 적어 두지 못해도 이번 화면에서는 그대로 보여요.
  }
}

let countryNames: Intl.DisplayNames | null = null

function countryName(code: string | undefined, fallback: string | undefined): string {
  try {
    countryNames ??= new Intl.DisplayNames('ko', { type: 'region' })
    return (code && countryNames.of(code)) || fallback || ''
  } catch {
    return fallback ?? ''
  }
}

interface Lookup {
  success?: boolean
  country?: string
  country_code?: string
  region?: string
  city?: string
}

/** 같은 주소를 화면 여러 곳에서 물어도 요청은 한 번만 보내요. */
const pending = new Map<string, Promise<string | null>>()

function lookupIpPlace(ip: string): Promise<string | null> {
  if (isPrivateIp(ip)) return Promise.resolve(pick(LOCAL_PLACE_TEXT))
  const stored = readStored()[ip]
  if (stored) return Promise.resolve(stored)

  let request = pending.get(ip)
  if (!request) {
    request = fetch(`${LOOKUP_URL}${encodeURIComponent(ip)}`)
      .then((res) => (res.ok ? (res.json() as Promise<Lookup>) : null))
      .then((data) => {
        if (!data || data.success === false) return null
        const place = [data.city || data.region, countryName(data.country_code, data.country)].filter(Boolean).join(', ')
        if (!place) return null
        store(ip, place)
        return place
      })
      .catch(() => null)
    pending.set(ip, request)
  }
  return request
}

/** IP 주소의 위치를 돌려줘요. 아직 모르거나 알아내지 못했으면 null이에요. */
export function useIpPlace(ip: string | null | undefined): string | null {
  const [place, setPlace] = useState<string | null>(() => (ip ? (isPrivateIp(ip) ? pick(LOCAL_PLACE_TEXT) : (readStored()[ip] ?? null)) : null))

  useEffect(() => {
    if (!ip) {
      setPlace(null)
      return
    }
    let stale = false
    void lookupIpPlace(ip).then((value) => {
      if (!stale) setPlace(value)
    })
    return () => {
      stale = true
    }
  }, [ip])

  return place
}
