const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

const DAY_MS = 86_400_000

export function parseServerTime(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatClock(date: Date): string {
  return date.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })
}

export function formatDate(date: Date, now = new Date()): string {
  const sameYear = date.getFullYear() === now.getFullYear()
  return sameYear
    ? `${date.getMonth() + 1}월 ${date.getDate()}일`
    : `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`
}

export function formatWhen(value: string | null | undefined, now = new Date()): string {
  const date = parseServerTime(value)
  if (!date) return ''
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS)
  if (days <= 0) return formatClock(date)
  if (days === 1) return '어제'
  return formatDate(date, now)
}

export function formatDateTime(value: string | null | undefined, now = new Date()): string {
  const date = parseServerTime(value)
  if (!date) return ''
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS)
  const day = days <= 0 ? '오늘' : days === 1 ? '어제' : formatDate(date, now)
  return `${day} ${formatClock(date)}`
}
