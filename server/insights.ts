import { FOLLOWUP_LABELS, type ChartSpec, type ChatEvent, type FollowupPerson, type FollowupQuestion } from '../shared/types.ts'
import { TtlCache } from './cache.ts'
import { aiEnabled, analyzeContributor, narrateOrNull } from './gemini.ts'
import type { GitHub, Pull } from './github.ts'
import { createLoginResolver, isBot, isMergeCommit } from './stats.ts'
import { formatNumber, sanitize, truncate } from './text.ts'

/** 추가 질문에 답할 때 살펴보는 최대 커밋 수 (최근 순) */
const MAX_INSIGHT_COMMITS = 1000
/** 추가 질문 말풍선에 고를 수 있게 보여주는 최대 인원 */
const MAX_PEOPLE = 15
const DAY_MS = 24 * 60 * 60 * 1000

export const FOLLOWUP_TEXT = '더 궁금한 점이 있나요?'
export const MENU_TEXT = '무엇부터 살펴볼까요?'

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
  /** 협업 방식을 볼 때 한 번 받아 두는 파일 목록 */
  files?: string[]
}

type Emit = (event: ChatEvent) => void

/** 질문마다 설명에서 짚어 주면 좋은 관점이에요. */
const NARRATION_GUIDES: Record<FollowupQuestion, string> = {
  hours: '팀이 아침형인지 저녁형인지 새벽형인지, 평일과 주말 중 언제 몰리는지, 참여자마다 활동 시간이 어떻게 다른지 짚어 줘요. 시간은 사용자의 시간대 기준이에요.',
  timeline: '초반부터 꾸준히 진행됐는지, 쉬었다가 몰아서 했는지, 언제 가장 바빴는지 흐름을 이야기해 줘요.',
  spurt: '마감 직전에 작업이 얼마나 몰렸는지, 미리 해 둔 사람과 막판에 속도를 낸 사람이 어떻게 다른지 짚어 줘요.',
  convention: '팀이 커밋 메시지 규칙을 얼마나 잘 지켰는지, 어떤 종류의 작업이 많았는지 태그 분포로 읽어 줘요.',
  pulls: 'PR을 누가 주도했는지, 머지까지 걸린 시간으로 볼 때 리뷰를 꼼꼼히 하는 팀인지 빠르게 합치는 팀인지 짚어 줘요.',
  teamwork: '이 팀이 어떤 약속으로 함께 일하는지, 다른 팀이 그대로 따라 할 수 있게 핵심 방식을 짚어 줘요. 브랜치와 PR을 쓰는 방식, 커밋 메시지 규칙, 작업을 쪼개는 크기를 중심으로 이야기해요.',
  person: '이 참여자가 언제, 어떤 리듬으로, 어떤 종류의 작업을 주로 했는지 한 사람의 작업 방식으로 그려 줘요.',
}

const insightsCache = new TtlCache<Insights>(60 * 60 * 1000, 200)

/** 참여자를 고르는 버튼과 추가 질문 답변에서 같은 사람을 가리키는 데 쓰는 값이에요. */
export function personId(login: string | null, name: string): string {
  return (login ?? name).trim().toLowerCase()
}

/** 분석 중에 정리한 참여자별 맡은 기능이에요. 특정 참여자를 자세히 볼 때 다시 꺼내 써요. */
const featuresCache = new TtlCache<string[]>(24 * 60 * 60 * 1000, 1000)
/** 맡은 기능을 새로 정리할 때 보내는 최대 커밋 메시지 수 */
const FEATURE_MESSAGE_LIMIT = 50

export function rememberFeatures(cacheKey: string, id: string, features: string[]): void {
  if (features.length > 0) featuresCache.set(`${cacheKey}:${id}`, features)
}

/** 분석에서 다루지 않은 참여자는 커밋 메시지와 PR 제목만으로 맡은 기능을 정리해요. 정리하지 못하면 빈 목록을 돌려줘요. */
async function loadFeatures(
  cacheKey: string,
  person: FollowupPerson & { commits: InsightCommit[] },
  pulls: Pull[],
): Promise<string[]> {
  const cached = featuresCache.get(`${cacheKey}:${person.id}`)
  if (cached) return cached
  if (!aiEnabled()) return []
  try {
    const { features } = await analyzeContributor({
      name: person.name,
      repoSummary: '',
      topPaths: [],
      commitMessages: person.commits.slice(0, FEATURE_MESSAGE_LIMIT).map((commit) => truncate(commit.title, 120)),
      pullTitles: pulls
        .filter((pull) => pull.user?.login.toLowerCase() === person.id)
        .slice(0, 30)
        .map((pull) => truncate(pull.title, 120)),
      diffs: '',
    })
    rememberFeatures(cacheKey, person.id, features)
    return features
  } catch (err) {
    console.error(err)
    return []
  }
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

const HOUR_COLUMNS = Array.from({ length: 24 }, (_, hour) => `${hour}시`)

function weekdayChart(title: string, weekdays: number[]): ChartSpec {
  return {
    title,
    kind: 'bars',
    // 월요일부터 보여줘요.
    items: [1, 2, 3, 4, 5, 6, 0].map((day) => ({
      label: `${WEEKDAYS[day]}요일`,
      value: weekdays[day],
      display: `${formatNumber(weekdays[day])}개`,
    })),
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

  const people = listPeople(commits).slice(0, MAX_PEOPLE)

  emit({
    type: 'chart',
    text: `주로 **${hourLabel(peakIndex(hours))}쯤** 가장 활발했어요. 요일로는 **${peakDay}요일**에 가장 많이 작업했고, 자정부터 새벽 6시 사이 커밋은 전체의 ${percent(lateNight, commits.length)}%예요. 시간은 지금 쓰는 기기의 시간대 기준이에요.`,
    charts: [
      hourChart('시간대별 커밋 수', hours),
      {
        title: '참여자별 활동 시간',
        kind: 'heatmap',
        columns: HOUR_COLUMNS,
        rows: people.map((person) => ({ label: person.name, values: hourCounts(person.commits, clock) })),
      },
      weekdayChart('요일별 커밋 수', weekdays),
    ],
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
    text: `${dateLabel(first)}에 시작해서 ${dateLabel(last)}까지 **${formatNumber(spanDays)}일 동안** 이어졌어요. 그중 실제로 커밋이 있었던 날은 ${formatNumber(activeDays)}일이에요.`,
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
        : `마지막 ${stretchDays}일 동안 ${top.name}님이 **자기 커밋의 ${top.share}%**를 올렸어요. 팀 전체로는 커밋의 ${overall}%가 이 기간에 몰려 있어요.`,
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
        ? `커밋 메시지의 **${rate}%**가 "태그: 내용" 형식을 따르고 있어요. 가장 많이 쓴 태그는 ${topTags[0][0]}예요. 제목 길이는 평균 ${Math.round(titleLength / commits.length)}자예요.`
        : `"태그: 내용" 형식을 따른 커밋은 **${rate}%**예요. 정해진 규칙보다는 자유롭게 쓴 편이에요. 제목 길이는 평균 ${Math.round(titleLength / commits.length)}자예요.`,
    charts,
  })
}

/** 브랜치 이름에서 "feat/로그인"의 feat 같은 앞머리를 꺼내요. */
function branchPrefix(ref: string): string | null {
  const match = /^([A-Za-z]+)[/_-]/.exec(ref)
  return match ? match[1].toLowerCase() : null
}

const TEAM_FILES: { label: string; pattern: RegExp; tip: string }[] = [
  { label: 'PR 템플릿', pattern: /(^|\/)pull_request_template(\.md|\/)/i, tip: 'PR 템플릿을 만들어 두고 PR마다 같은 양식으로 설명을 적어요' },
  { label: '이슈 템플릿', pattern: /(^|\/)issue_template(\.md|\/)/i, tip: '이슈 템플릿을 만들어 두고 할 일을 이슈로 먼저 적은 다음에 작업해요' },
  { label: '자동 검사와 배포', pattern: /^\.github\/workflows\/.+\.ya?ml$/i, tip: 'GitHub Actions로 검사와 배포를 자동으로 돌려요' },
  { label: '기여 안내 문서', pattern: /(^|\/)contributing(\.md)?$/i, tip: '작업 규칙을 기여 안내 문서로 적어 두고 팀이 함께 봐요' },
  { label: '코드 담당자 지정', pattern: /(^|\/)codeowners$/i, tip: '코드 담당자를 정해 두고 그 사람이 리뷰하게 해요' },
]

/** 이 팀이 함께 일하는 방식을 정리하고, 그대로 따라 할 수 있는 방법을 목록으로 알려줘요. */
async function answerTeamwork(insights: Insights, gh: GitHub, owner: string, repo: string, clock: Clock, emit: Emit) {
  const { commits } = insights
  const pulls = insights.pulls.filter((pull) => pull.user && !pull.user.login.endsWith('[bot]'))
  insights.files ??= await gh.getTree(owner, repo, 'HEAD').catch(() => [] as string[])
  const files = insights.files

  const tips: string[] = []

  // 브랜치와 PR
  const merged = pulls.filter((pull) => pull.merged_at)
  const mergeTimes = merged.map((pull) => Date.parse(pull.merged_at!) - Date.parse(pull.created_at)).sort((a, b) => a - b)
  const median = mergeTimes.length > 0 ? mergeTimes[Math.floor(mergeTimes.length / 2)] : null
  const prefixes = new Map<string, number>()
  let named = 0
  for (const pull of pulls) {
    const prefix = pull.head?.ref ? branchPrefix(pull.head.ref) : null
    if (!prefix) continue
    named += 1
    prefixes.set(prefix, (prefixes.get(prefix) ?? 0) + 1)
  }
  // 한 번만 나온 앞머리는 규칙이라기보다 우연이라서 빼요.
  const repeated = [...prefixes.entries()].filter(([, count]) => count >= 2)
  const topPrefixes = (repeated.length > 0 ? repeated : [...prefixes.entries()])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([prefix]) => prefix)
  const bases = new Map<string, number>()
  for (const pull of pulls) if (pull.base?.ref) bases.set(pull.base.ref, (bases.get(pull.base.ref) ?? 0) + 1)
  const topBase = [...bases.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const usesPulls = pulls.length >= 3 && pulls.length * 10 >= commits.length
  const branchRule = named > 0 && named * 2 >= pulls.length

  let flow: string
  if (usesPulls) {
    flow = branchRule ? `${topPrefixes.map((prefix) => `${prefix}/`).join(', ')} 브랜치에서 작업하고 PR로 합쳐요` : '브랜치에서 작업하고 PR로 합쳐요'
    tips.push(
      branchRule
        ? `작업마다 "${topPrefixes[0]}/작업 이름"처럼 종류를 앞에 붙인 브랜치를 새로 만들어요`
        : '작업마다 브랜치를 새로 만들어요',
    )
    tips.push(topBase ? `작업이 끝나면 ${topBase} 브랜치로 PR을 올려서 합쳐요` : '작업이 끝나면 PR을 올려서 합쳐요')
    if (median !== null) {
      tips.push(
        median < 60 * 60 * 1000
          ? 'PR은 오래 묵히지 않고 올린 지 한 시간 안에 합쳐요'
          : `PR은 올린 뒤 ${formatDuration(median)} 안팎으로 확인하고 합쳐요`,
      )
    }
  } else if (pulls.length > 0) {
    flow = '주로 브랜치에 바로 커밋하고, PR은 가끔만 써요'
    tips.push('작은 수정은 기본 브랜치에 바로 커밋하고, 큰 작업만 PR로 올려요')
  } else {
    flow = 'PR 없이 브랜치에 바로 커밋해요'
    tips.push('PR 없이 기본 브랜치에 바로 커밋하면서 빠르게 진행해요')
  }

  // 커밋 메시지
  const tagCounts = new Map<string, number>()
  let tagged = 0
  let korean = 0
  for (const commit of commits) {
    if (/[가-힣]/.test(commit.title)) korean += 1
    const tag = TAG_PATTERN.exec(commit.title)?.[1].toLowerCase()
    if (!tag) continue
    tagged += 1
    tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
  }
  const tagRate = percent(tagged, commits.length)
  const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([tag]) => tag)
  const language = korean * 2 >= commits.length ? '한국어' : '영어'
  if (tagRate >= 60) {
    tips.push(`커밋 메시지는 "${topTags[0]}: 내용"처럼 태그를 앞에 붙이고, ${topTags.join(', ')} 태그를 주로 써요`)
  }
  tips.push(`커밋 메시지는 ${language}로 짧게 써요`)

  // 작업을 쪼개는 크기
  const zoned = commits.map((commit) => clock(commit.at))
  const activeDays = new Set(zoned.map((item) => item.dayNumber)).size
  const perDay = Math.round((commits.length / Math.max(1, activeDays)) * 10) / 10
  if (perDay >= 4) tips.push(`작업을 잘게 쪼개서 작업하는 날에는 하루에 ${perDay}개쯤 커밋해요`)
  else tips.push('한 번에 몰아서 올리지 않고, 기능 하나가 끝날 때마다 커밋해요')

  // 저장소에 마련해 둔 약속
  const found = TEAM_FILES.filter((item) => files.some((path) => item.pattern.test(path)))
  for (const item of found) tips.push(item.tip)

  emit({
    type: 'facts',
    text: '이 팀이 함께 일하는 방식을 정리했어요.',
    items: [
      { label: '작업을 합치는 방식', value: flow },
      { label: 'PR', value: pulls.length > 0 ? `${formatNumber(pulls.length)}개 중 ${formatNumber(merged.length)}개 머지` : '쓰지 않았어요' },
      { label: '머지까지 걸린 시간 (중앙값)', value: median === null ? '확인할 수 없어요' : formatDuration(median) },
      { label: '커밋 메시지 규칙', value: tagRate >= 60 ? `"태그: 내용" 형식 (${tagRate}%가 따름)` : `정해진 형식 없이 자유롭게 (태그 사용 ${tagRate}%)` },
      { label: '커밋 메시지 언어', value: language },
      { label: '작업하는 날의 하루 평균 커밋', value: `${perDay}개` },
      { label: '저장소에 마련해 둔 것', value: found.length > 0 ? found.map((item) => item.label).join(', ') : '따로 없어요' },
    ],
  })
  emit({ type: 'list', text: '이 팀처럼 일하고 싶다면 이렇게 해 보세요.', items: tips.slice(0, 8) })
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

async function answerPerson(insights: Insights, clock: Clock, id: string | undefined, cacheKey: string, emit: Emit) {
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
    text: `**${person.name}**님을 자세히 살펴봤어요.`,
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
    text: `${person.name}님이 커밋한 시간대와 요일이에요.`,
    charts: [hourChart('시간대별 커밋 수', hours), weekdayChart('요일별 커밋 수', weekdays)],
  })
  const features = await loadFeatures(cacheKey, person, insights.pulls)
  if (features.length > 0) {
    emit({ type: 'list', text: `${person.name}님이 맡은 기능이에요.`, items: features })
    return
  }
  // 맡은 기능을 정리하지 못했을 때만 최근 커밋 제목으로 대신해요.
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

/** analysis가 true면 아직 기여도 분석 전이라, 메뉴에 기여도 분석 버튼도 함께 보여줘요. */
export function followupEvent(people: FollowupPerson[], options: { text?: string; analysis?: boolean } = {}): ChatEvent {
  return {
    type: 'followup',
    text: options.text ?? FOLLOWUP_TEXT,
    people: people.slice(0, MAX_PEOPLE),
    ...(options.analysis ? { analysis: true } : {}),
  }
}

/** 레포 소개 직후에 보여주는 메뉴예요. 참여자 목록을 받지 못해도 메뉴는 보여줘요. */
export async function menuEvent(gh: GitHub, owner: string, repo: string, cacheKey: string): Promise<ChatEvent> {
  const people = await loadInsights(gh, owner, repo, cacheKey)
    .then((insights) => listPeople(insights.commits).map(({ id, name }) => ({ id, name })))
    .catch(() => [] as FollowupPerson[])
  return followupEvent(people, { text: MENU_TEXT, analysis: true })
}

/** 메뉴에서 고른 질문에 답해요. 커밋 목록과 PR 목록만으로 계산해요. */
export async function answerFollowup(options: {
  gh: GitHub
  owner: string
  repo: string
  /** 레포와 사용자 범위가 담긴 캐시 키 */
  cacheKey: string
  question: FollowupQuestion
  person?: string
  /** 기여도 분석을 하기 전에 고른 질문인지 */
  early?: boolean
  timeZone?: string
  emit: Emit
}): Promise<void> {
  const { gh, owner, repo, question, emit } = options
  const again = () => followupEvent(people, { analysis: options.early })
  const insights = await loadInsights(gh, owner, repo, options.cacheKey)
  const people = listPeople(insights.commits).map(({ id, name }) => ({ id, name }))

  if (insights.commits.length === 0) {
    emit({ type: 'text', text: '살펴볼 커밋이 없어서 답하기 어려워요.' })
    if (options.early) emit(again())
    return
  }
  if (insights.capped && question !== 'pulls') {
    emit({ type: 'text', text: `커밋이 많아서 최근 ${formatNumber(MAX_INSIGHT_COMMITS)}개를 기준으로 답할게요.` })
  }

  // 먼저 숫자와 그래프를 계산해서 모아 두고, 그 내용을 읽어서 풀어 쓴 설명을 첫 말풍선에 얹어요.
  const answer: ChatEvent[] = []
  const collect: Emit = (event) => answer.push(event)

  const clock = createClock(options.timeZone ?? 'Asia/Seoul')
  switch (question) {
    case 'hours':
      answerHours(insights, clock, collect)
      break
    case 'timeline':
      answerTimeline(insights, clock, collect)
      break
    case 'spurt':
      answerSpurt(insights, collect)
      break
    case 'convention':
      answerConvention(insights, collect)
      break
    case 'pulls':
      answerPulls(insights, collect)
      break
    case 'teamwork':
      await answerTeamwork(insights, gh, owner, repo, clock, collect)
      break
    case 'person':
      await answerPerson(insights, clock, options.person, options.cacheKey, collect)
      break
  }

  const first = answer[0]
  if (first && (first.type === 'chart' || first.type === 'facts')) {
    const topic = question === 'person' ? `${options.person} 참여자는 어떻게 작업했나요?` : FOLLOWUP_LABELS[question]
    const story = await narrateOrNull(topic, answer, NARRATION_GUIDES[question])
    if (story) first.text = story
  }
  answer.forEach(emit)

  emit(again())
}
