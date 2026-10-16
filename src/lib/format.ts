import { getLang, messages, pick } from './i18n'

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

const DAY_MS = 86_400_000

export function parseServerTime(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const LOCALES = { ko: 'ko-KR', en: 'en-US' } as const

function formatClock(date: Date): string {
  return date.toLocaleTimeString(LOCALES[getLang()], { hour: 'numeric', minute: '2-digit' })
}

export function formatDate(date: Date, now = new Date()): string {
  const sameYear = date.getFullYear() === now.getFullYear()
  if (getLang() === 'en') {
    return date.toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { year: 'numeric', month: 'short', day: 'numeric' })
  }
  return sameYear
    ? `${date.getMonth() + 1}월 ${date.getDate()}일`
    : `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`
}

const WORDS = messages({ ko: { today: '오늘', yesterday: '어제' }, en: { today: 'Today', yesterday: 'Yesterday' } })

export function formatWhen(value: string | null | undefined, now = new Date()): string {
  const date = parseServerTime(value)
  if (!date) return ''
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS)
  if (days <= 0) return formatClock(date)
  if (days === 1) return pick(WORDS).yesterday
  return formatDate(date, now)
}

export function formatDateTime(value: string | null | undefined, now = new Date()): string {
  const date = parseServerTime(value)
  if (!date) return ''
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS)
  const day = days <= 0 ? pick(WORDS).today : days === 1 ? pick(WORDS).yesterday : formatDate(date, now)
  return `${day} ${formatClock(date)}`
}
