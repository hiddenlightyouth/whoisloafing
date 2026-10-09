import type { ChartSpec, ChatEvent, FollowupPerson, FollowupQuestion } from '../shared/types.ts'
import { TtlCache } from './cache.ts'
import type { GitHub, Pull } from './github.ts'
import { createLoginResolver, isBot, isMergeCommit } from './stats.ts'
import { formatNumber, sanitize } from './text.ts'

/** 추가 질문에 답할 때 살펴보는 최대 커밋 수 (최근 순) */
const MAX_INSIGHT_COMMITS = 1000
/** 추가 질문 말풍선에 고를 수 있게 보여주는 최대 인원 */
const MAX_PEOPLE = 15
const DAY_MS = 24 * 60 * 60 * 1000

export const FOLLOWUP_TEXT = '더 궁금한 점이 있나요?'

interface InsightCommit {
  /** 계정 아이디, 계정을 찾지 못했으면 커밋 작성자 이름 (소문자) */
  personId: string
  name: string
  at: number
  title: string
}

interface Insights {
  /** 병합 커밋과 봇을 뺀 커밋 (최근 순) */
  commits: InsightCommit[]
  pulls: Pull[]
  capped: boolean
}

type Emit = (event: ChatEvent) => void

const insightsCache = new TtlCache<Insights>(60 * 60 * 1000, 200)

/** 참여자를 고르는 버튼과 추가 질문 답변에서 같은 사람을 가리키는 데 쓰는 값이에요. */
export function personId(login: string | null, name: string): string {
  return (login ?? name).trim().toLowerCase()
}

async function loadInsights(gh: GitHub, owner: string, repo: string, cacheKey: string): Promise<Insights> {
  const cached = insightsCache.get(cacheKey)
  if (cached) return cached

  const [listed, pulls] = await Promise.all([
    gh.listCommits(owner, repo, { perPage: 100, maxPages: MAX_INSIGHT_COMMITS / 100 }),
    gh.listPulls(owner, repo).catch(() => [] as Pull[]),
  ])
  const targets = listed.filter((commit) => !isMergeCommit(commit) && !isBot(commit.author))
  const resolveLogin = createLoginResolver(targets)

  const commits: InsightCommit[] = []
  for (const commit of targets) {
    const git = commit.commit.author
    const at = Date.parse(git?.date ?? '')
    if (Number.isNaN(at)) continue
    const login = resolveLogin(commit)
    const name = login ?? git?.name ?? '알 수 없는 작성자'
    commits.push({
      personId: personId(login, name),
      name: sanitize(name) || '이름 없는 작성자',
      at,
      title: commit.commit.message.split('\n')[0].trim(),
    })
  }

  const insights = { commits, pulls, capped: listed.length >= MAX_INSIGHT_COMMITS }
  insightsCache.set(cacheKey, insights)
  return insights
}

function listPeople(commits: InsightCommit[]): (FollowupPerson & { commits: InsightCommit[] })[] {
  const byId = new Map<string, FollowupPerson & { commits: InsightCommit[] }>()
  for (const commit of commits) {
    const person = byId.get(commit.personId) ?? { id: commit.personId, name: commit.name, commits: [] }
    person.commits.push(commit)
    byId.set(commit.personId, person)
  }
  return [...byId.values()].sort((a, b) => b.commits.length - a.commits.length)
}

// 시간 계산 -----------------------------------------------------------

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

interface Zoned {
  hour: number
  weekday: number
  year: number
  month: number
  day: number
  /** 날짜만 비교할 때 쓰는 일 단위 번호 */
  dayNumber: number
}

/** 사용자의 시간대에 맞춰 커밋 시각을 풀어 주는 함수를 만들어요. */
function createClock(timeZone: string) {
  let zone = timeZone
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
  } catch {
    zone = 'Asia/Seoul'
  }
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    weekday: 'short',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
  })
  return (at: number): Zoned => {
    const parts: Record<string, string> = {}
    for (const part of formatter.formatToParts(new Date(at))) parts[part.type] = part.value
    const year = Number(parts.year)
    const month = Number(parts.month)
    const day = Number(parts.day)
    return {
      hour: Number(parts.hour) % 24,
      weekday: WEEKDAY_INDEX[parts.weekday] ?? 0,
      year,
      month,
      day,
      dayNumber: Math.floor(Date.UTC(year, month - 1, day) / DAY_MS),
    }
  }
}

type Clock = ReturnType<typeof createClock>

const hourLabel = (hour: number) => `${hour < 12 ? '오전' : '오후'} ${hour % 12 || 12}시`
const dateLabel = (zoned: Zoned) => `${zoned.year}년 ${zoned.month}월 ${zoned.day}일`
const percent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0)

function peakIndex(counts: number[]): number {
  let best = 0
  counts.forEach((count, index) => {
    if (count > counts[best]) best = index
  })
  return best
}

function hourCounts(commits: InsightCommit[], clock: Clock): number[] {
  const counts = new Array<number>(24).fill(0)
  for (const commit of commits) counts[clock(commit.at).hour] += 1
  return counts
}

function hourChart(title: string, counts: number[]): ChartSpec {
  return {
    title,
    kind: 'columns',
    items: counts.map((value, hour) => ({ label: `${hour}시`, value, display: `${hour}시, ${formatNumber(value)}개` })),
  }
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `${Math.max(1, minutes)}분`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}시간`
  return `${Math.round(hours / 24)}일`
}

// 질문별 답변 ---------------------------------------------------------

function answerHours(insights: Insights, clock: Clock, emit: Emit) {
  const { commits } = insights
  const hours = hourCounts(commits, clock)
  const weekdays = new Array<number>(7).fill(0)
  for (const commit of commits) weekdays[clock(commit.at).weekday] += 1

  const lateNight = hours.slice(0, 6).reduce((sum, count) => sum + count, 0)
  const peakDay = WEEKDAYS[peakIndex(weekdays)]

  emit({
    type: 'chart',
    text: `주로 ${hourLabel(peakIndex(hours))}쯤 가장 활발했어요. 요일로는 ${peakDay}요일에 가장 많이 작업했고, 자정부터 새벽 6시 사이 커밋은 전체의 ${percent(lateNight, commits.length)}%예요.`,
    charts: [
      hourChart('시간대별 커밋 수', hours),
      {
        title: '요일별 커밋 수',
        kind: 'bars',
        // 월요일부터 보여줘요.
        items: [1, 2, 3, 4, 5, 6, 0].map((day) => ({
          label: `${WEEKDAYS[day]}요일`,
          value: weekdays[day],
          display: `${formatNumber(weekdays[day])}개`,
        })),
      },
    ],
  })

  emit({
    type: 'facts',
    text: '참여자별로 가장 활발한 시간이에요. 시간은 지금 쓰는 기기의 시간대 기준이에요.',
    items: listPeople(commits)
      .slice(0, MAX_PEOPLE)
      .map((person) => ({ label: person.name, value: hourLabel(peakIndex(hourCounts(person.commits, clock))) })),
  })
}

function answerTimeline(insights: Insights, clock: Clock, emit: Emit) {
  const zoned = insights.commits.map((commit) => clock(commit.at))
  const first = zoned.reduce((a, b) => (b.dayNumber < a.dayNumber ? b : a))
  const last = zoned.reduce((a, b) => (b.dayNumber > a.dayNumber ? b : a))
  const spanDays = last.dayNumber - first.dayNumber + 1

  // 기간이 짧으면 하루 단위, 길어지면 주 단위와 달 단위로 묶어요.
  const unit = spanDays <= 31 ? '일' : spanDays <= 183 ? '주' : '달'
  const buckets = new Map<number, { label: string; value: number }>()
  const bucketOf = (item: Zoned) =>
    unit === '일'
      ? item.dayNumber - first.dayNumber
      : unit === '주'
        ? Math.floor((item.dayNumber - first.dayNumber) / 7)
        : (item.year - first.year) * 12 + (item.month - first.month)

  const total = bucketOf(last) + 1
  for (let index = 0; index < total; index++) {
    let label: string
    if (unit === '달') {
      const month = first.month - 1 + index
      label = `${(first.year + Math.floor(month / 12)) % 100}년 ${(month % 12) + 1}월`
    } else {
      const date = new Date((first.dayNumber + index * (unit === '주' ? 7 : 1)) * DAY_MS)
      label = `${date.getUTCMonth() + 1}/${date.getUTCDate()}`
    }
    buckets.set(index, { label, value: 0 })
  }
  for (const item of zoned) buckets.get(bucketOf(item))!.value += 1

  const items = [...buckets.values()]
  const busiest = items.reduce((a, b) => (b.value > a.value ? b : a))
  const activeDays = new Set(zoned.map((item) => item.dayNumber)).size

  emit({
    type: 'chart',
    text: `${dateLabel(first)}에 시작해서 ${dateLabel(last)}까지 ${formatNumber(spanDays)}일 동안 이어졌어요. 그중 실제로 커밋이 있었던 날은 ${formatNumber(activeDays)}일이에요.`,
    charts: [
      {
        title: `${unit} 단위 커밋 수`,
        kind: 'columns',
        items: items.map((item) => ({ ...item, display: `${item.label}, ${formatNumber(item.value)}개` })),
      },
    ],
  })
  emit({
    type: 'facts',
    text: '진행 흐름을 숫자로 정리했어요.',
    items: [
      { label: '첫 커밋', value: dateLabel(first) },
      { label: '마지막 커밋', value: dateLabel(last) },
      { label: '전체 기간', value: `${formatNumber(spanDays)}일` },
      { label: '커밋이 있었던 날', value: `${formatNumber(activeDays)}일` },
      { label: `가장 바빴던 ${unit}`, value: `${busiest.label}, ${formatNumber(busiest.value)}개` },
      { label: '하루 평균 커밋', value: `${(insights.commits.length / spanDays).toFixed(1)}개` },
    ],
  })
}

function answerSpurt(insights: Insights, emit: Emit) {
  const { commits } = insights
  const last = Math.max(...commits.map((commit) => commit.at))
  const first = Math.min(...commits.map((commit) => commit.at))
  const duration = last - first
  if (duration < 2 * DAY_MS) {
    emit({ type: 'text', text: '프로젝트 기간이 이틀도 되지 않아서 막판을 따로 나눠 보기 어려워요.' })
    return
  }

  // 전체 기간의 마지막 20%를 막판으로 봐요. 최소 하루는 잡아요.
  const stretch = Math.max(duration * 0.2, DAY_MS)
  const stretchStart = last - stretch
  const stretchDays = Math.max(1, Math.round(stretch / DAY_MS))
  const inStretch = (items: InsightCommit[]) => items.filter((commit) => commit.at >= stretchStart).length

  const people = listPeople(commits)
    .slice(0, MAX_PEOPLE)
    .map((person) => ({
      name: person.name,
      total: person.commits.length,
      late: inStretch(person.commits),
      share: percent(inStretch(person.commits), person.commits.length),
    }))
    .sort((a, b) => b.share - a.share || b.late - a.late)

  const top = people[0]
  const overall = percent(inStretch(commits), commits.length)
  emit({
    type: 'chart',
    text:
      top.late === 0
        ? `마지막 ${stretchDays}일 동안에는 커밋이 거의 없었어요. 막판에 몰아서 작업한 사람은 없어요.`
        : `마지막 ${stretchDays}일 동안 ${top.name}님이 자기 커밋의 ${top.share}%를 올렸어요. 팀 전체로는 커밋의 ${overall}%가 이 기간에 몰려 있어요.`,
    charts: [
      {
        title: `마지막 ${stretchDays}일에 올린 커밋 비율 (각자 커밋 대비)`,
        kind: 'bars',
        items: people.map((person) => ({
          label: person.name,
          value: person.share,
          display: `${person.share}% (${formatNumber(person.late)}개)`,
        })),
      },
    ],
  })
}

const TAG_PATTERN = /^([A-Za-z]+)(?:\([^)]*\))?!?:\s*\S/

function answerConvention(insights: Insights, emit: Emit) {
  const { commits } = insights
  const tagOf = (commit: InsightCommit) => TAG_PATTERN.exec(commit.title)?.[1].toLowerCase() ?? null

  const tagCounts = new Map<string, number>()
  let tagged = 0
  let titleLength = 0
  for (const commit of commits) {
    titleLength += commit.title.length
    const tag = tagOf(commit)
    if (!tag) continue
    tagged += 1
    tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
  }
  const rate = percent(tagged, commits.length)
  const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)

  const charts: ChartSpec[] = []
  if (topTags.length > 0) {
    charts.push({
      title: '자주 쓴 태그',
      kind: 'bars',
      items: topTags.map(([tag, count]) => ({ label: tag, value: count, display: `${formatNumber(count)}개` })),
    })
  }
  charts.push({
    title: '참여자별 "태그: 내용" 형식을 따른 비율',
    kind: 'bars',
    items: listPeople(commits)
      .slice(0, MAX_PEOPLE)
      .map((person) => {
        const share = percent(person.commits.filter((commit) => tagOf(commit)).length, person.commits.length)
        return { label: person.name, value: share, display: `${share}%` }
      }),
  })

  emit({
    type: 'chart',
    text:
      rate >= 60
        ? `커밋 메시지의 ${rate}%가 "태그: 내용" 형식을 따르고 있어요. 가장 많이 쓴 태그는 ${topTags[0][0]}예요. 제목 길이는 평균 ${Math.round(titleLength / commits.length)}자예요.`
        : `"태그: 내용" 형식을 따른 커밋은 ${rate}%예요. 정해진 규칙보다는 자유롭게 쓴 편이에요. 제목 길이는 평균 ${Math.round(titleLength / commits.length)}자예요.`,
    charts,
  })
}

function answerPulls(insights: Insights, emit: Emit) {
  const pulls = insights.pulls.filter((pull) => pull.user && !pull.user.login.endsWith('[bot]'))
  if (pulls.length === 0) {
    emit({ type: 'text', text: '이 레포에는 PR이 없어요. 브랜치에 바로 커밋하면서 작업한 것 같아요.' })
    return
  }

  const counts = new Map<string, number>()
  for (const pull of pulls) counts.set(pull.user!.login, (counts.get(pull.user!.login) ?? 0) + 1)
  const authors = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_PEOPLE)

  const merged = pulls.filter((pull) => pull.merged_at)
  const mergeTimes = merged
    .map((pull) => Date.parse(pull.merged_at!) - Date.parse(pull.created_at))
    .filter((ms) => ms >= 0)
    .sort((a, b) => a - b)
  const median = mergeTimes.length > 0 ? mergeTimes[Math.floor(mergeTimes.length / 2)] : null
  const open = pulls.filter((pull) => pull.state === 'open').length

  emit({
    type: 'chart',
    text: `${insights.pulls.length >= 100 ? '최근 PR 100개' : `PR ${formatNumber(pulls.length)}개`}를 살펴봤어요. ${sanitize(authors[0][0])}님이 가장 많이 올렸어요.`,
    charts: [
      {
        title: '참여자별 PR 수',
        kind: 'bars',
        items: authors.map(([login, count]) => ({
          label: sanitize(login),
          value: count,
          display: `${formatNumber(count)}개`,
        })),
      },
    ],
  })
  emit({
    type: 'facts',
    text: 'PR을 숫자로 정리했어요.',
    items: [
      { label: '머지된 PR', value: `${formatNumber(merged.length)}개 (${percent(merged.length, pulls.length)}%)` },
      { label: '아직 열려 있는 PR', value: `${formatNumber(open)}개` },
      { label: '머지까지 걸린 시간 (중앙값)', value: median === null ? '확인할 수 없어요' : formatDuration(median) },
    ],
  })
}

function answerPerson(insights: Insights, clock: Clock, id: string | undefined, emit: Emit) {
  const person = listPeople(insights.commits).find((candidate) => candidate.id === id?.trim().toLowerCase())
  if (!person) {
    emit({ type: 'text', text: '그 참여자의 커밋을 찾지 못했어요. 다른 참여자를 골라 주세요.' })
    return
  }

  const zoned = person.commits.map((commit) => clock(commit.at))
  const first = zoned.reduce((a, b) => (b.dayNumber < a.dayNumber ? b : a))
  const last = zoned.reduce((a, b) => (b.dayNumber > a.dayNumber ? b : a))
  const hours = hourCounts(person.commits, clock)
  const weekdays = new Array<number>(7).fill(0)
  for (const item of zoned) weekdays[item.weekday] += 1
  const activeDays = new Set(zoned.map((item) => item.dayNumber)).size

  const tags = new Map<string, number>()
  for (const commit of person.commits) {
    const tag = TAG_PATTERN.exec(commit.title)?.[1].toLowerCase()
    if (tag) tags.set(tag, (tags.get(tag) ?? 0) + 1)
  }
  const topTags = [...tags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  const pullCount = insights.pulls.filter((pull) => pull.user?.login.toLowerCase() === person.id).length

  emit({
    type: 'facts',
    text: `${person.name}님을 자세히 살펴봤어요.`,
    items: [
      { label: '커밋 수', value: `${formatNumber(person.commits.length)}개 (전체의 ${percent(person.commits.length, insights.commits.length)}%)` },
      { label: '첫 커밋', value: dateLabel(first) },
      { label: '마지막 커밋', value: dateLabel(last) },
      { label: '커밋이 있었던 날', value: `${formatNumber(activeDays)}일` },
      { label: '하루에 가장 많이 올린 커밋', value: `${formatNumber(Math.max(...countBy(zoned.map((item) => item.dayNumber))))}개` },
      { label: '가장 활발한 시간', value: hourLabel(peakIndex(hours)) },
      { label: '가장 활발한 요일', value: `${WEEKDAYS[peakIndex(weekdays)]}요일` },
      { label: '자주 쓴 커밋 태그', value: topTags.length > 0 ? topTags.map(([tag, count]) => `${tag} ${count}개`).join(', ') : '태그를 쓰지 않았어요' },
      { label: '올린 PR', value: `${formatNumber(pullCount)}개` },
    ],
  })
  emit({
    type: 'chart',
    text: `${person.name}님이 커밋한 시간대예요.`,
    charts: [hourChart('시간대별 커밋 수', hours)],
  })
  emit({
    type: 'list',
    text: `${person.name}님이 가장 최근에 한 작업이에요.`,
    items: person.commits
      .slice(0, 6)
      .map((commit) => sanitize(commit.title).slice(0, 80))
      .filter(Boolean),
  })
}

function countBy(values: number[]): number[] {
  const counts = new Map<number, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.values()]
}

export function followupEvent(people: FollowupPerson[]): ChatEvent {
  return { type: 'followup', text: FOLLOWUP_TEXT, people: people.slice(0, MAX_PEOPLE) }
}

/** 분석이 끝난 뒤에 이어서 받는 질문에 답해요. 커밋 목록과 PR 목록만으로 계산해요. */
export async function answerFollowup(options: {
  gh: GitHub
  owner: string
  repo: string
  /** 레포와 사용자 범위가 담긴 캐시 키 */
  cacheKey: string
  question: FollowupQuestion
  person?: string
  timeZone?: string
  emit: Emit
}): Promise<void> {
  const { gh, owner, repo, question, emit } = options
  const insights = await loadInsights(gh, owner, repo, options.cacheKey)
  const people = listPeople(insights.commits).map(({ id, name }) => ({ id, name }))

  if (insights.commits.length === 0) {
    emit({ type: 'text', text: '살펴볼 커밋이 없어서 답하기 어려워요.' })
    return
  }
  if (insights.capped && question !== 'pulls') {
    emit({ type: 'text', text: `커밋이 많아서 최근 ${formatNumber(MAX_INSIGHT_COMMITS)}개를 기준으로 답할게요.` })
  }

  const clock = createClock(options.timeZone ?? 'Asia/Seoul')
  switch (question) {
    case 'hours':
      answerHours(insights, clock, emit)
      break
    case 'timeline':
      answerTimeline(insights, clock, emit)
      break
    case 'spurt':
      answerSpurt(insights, emit)
      break
    case 'convention':
      answerConvention(insights, emit)
      break
    case 'pulls':
      answerPulls(insights, emit)
      break
    case 'person':
      answerPerson(insights, clock, options.person, emit)
      break
  }

  emit(followupEvent(people))
}
