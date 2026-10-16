import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { FolderPerson, StructureNode } from '../../shared/types'
import { track } from '../lib/analytics'
import { fetchDeepReport } from '../lib/api'
import { useShortcuts } from '../lib/shortcuts'
import { MapMenu, tag } from './DeepParts'
import { getLang, messages, useMessages } from '../lib/i18n'
import { readFlag, readItem, readJson, writeFlag, writeItem, writeJson } from '../lib/storage'

interface Props {
  /** 맵 한가운데서 가지가 뻗어 나가는 뿌리 칸에 적을 이름 (레포 이름) */
  name: string
  /** 소유자/레포. 참여자별 보기를 받아 올 때 써요. */
  repo: string
  root: StructureNode
}

const NODE_W = 208
/** 설명을 보여줄 때와 숨길 때의 칸 높이 */
const NODE_H = 50
const NODE_H_COMPACT = 34
const COL_GAP = 72
const ROW_GAP = 10
/** 세로로 뻗을 때 위아래 단 사이와, 옆으로 나란한 칸 사이의 간격 */
const LEVEL_GAP = 64
const SIDE_GAP = 14
const MIN_ZOOM = 0.3
const MAX_ZOOM = 1.6
const READABLE_ZOOM = 0.7
/** 이만큼 넘게 움직이면 누른 것이 아니라 끌어서 옮긴 것으로 봐요. */
const DRAG_PX = 4

interface Placed {
  node: StructureNode
  x: number
  y: number
  depth: number
  parent: Placed | null
}

const count = (value: number) => value.toLocaleString(getLang() === 'ko' ? 'ko-KR' : 'en-US')

const TEXT = messages({
  ko: {
    files: (n: string) => `파일 ${n}개`,
    times: (n: string) => `${n}번`,
    share: (files: string, percent: number) => `파일 ${files}개, 전체의 ${percent}%`,
    edited: (name: string, n: string) => `${name}님이 여기 파일을 ${n}번 고쳤어요`,
    view: '보기',
    folders: '폴더',
    main: '주요 폴더만 펼치기',
    source: '소스 폴더만 펼치기',
    expandAll: '모두 펼치기',
    collapseAll: '모두 접기',
    display: '표시',
    roles: '폴더 설명',
    people: '참여자',
    noCommits: '살펴볼 커밋이 없어요.',
    all: '전체',
    commits: (n: string) => `${n}개의 커밋`,
    horizontal: '가로로 뻗기',
    vertical: '세로로 뻗기',
    select: '선택',
    hand: '손',
    pen: '펜',
    rect: '사각형',
    ellipse: '원',
    clear: '그림 지우기',
    reset: '배치 되돌리기',
    zoomOut: '축소',
    zoomIn: '확대',
    smaller: '작게',
    bigger: '크게',
    fit: '한눈에 보기',
  },
  en: {
    files: (n: string) => `${n} ${n === '1' ? 'file' : 'files'}`,
    times: (n: string) => `${n}x`,
    share: (files: string, percent: number) => `${files} ${files === '1' ? 'file' : 'files'}, ${percent}% of the repo`,
    edited: (name: string, n: string) => `${name} changed files here ${n} ${n === '1' ? 'time' : 'times'}`,
    view: 'View',
    folders: 'Folders',
    main: 'Expand main folders',
    source: 'Expand source folders',
    expandAll: 'Expand all',
    collapseAll: 'Collapse all',
    display: 'Display',
    roles: 'Folder descriptions',
    people: 'Contributors',
    noCommits: 'No commits to look at.',
    all: 'All',
    commits: (n: string) => `${n} ${n === '1' ? 'commit' : 'commits'}`,
    horizontal: 'Branch right',
    vertical: 'Branch down',
    select: 'Select',
    hand: 'Hand',
    pen: 'Pen',
    rect: 'Rectangle',
    ellipse: 'Ellipse',
    clear: 'Clear drawings',
    reset: 'Reset layout',
    zoomOut: 'Zoom out',
    zoomIn: 'Zoom in',
    smaller: 'Zoom out',
    bigger: 'Zoom in',
    fit: 'Fit to screen',
  },
})


/** 코드가 아니라 설정, 문서, 자료가 들어 있는 폴더 이름. 처음에는 접어 둬요. */
const SIDE_FOLDERS = new Set([
  'gradle', 'docs', 'doc', 'scripts', 'public', 'static', 'assets', 'images', 'img', 'patches',
  'examples', 'example', 'playground', 'fixtures', 'vendor', 'third_party', 'node_modules', 'build', 'dist',
])

const isSide = (node: StructureNode) => {
  const first = node.name.split('/')[0].toLowerCase()
  return first.startsWith('.') || SIDE_FOLDERS.has(first)
}

/** 처음에 펼쳐 둘 폴더예요. 코드가 든 폴더는 끝까지 펼치고, 설정이나 문서 같은 곁가지 폴더는 접어 둬요. */
function sourceFolders(root: StructureNode): Set<string> {
  const open = new Set<string>()
  const visit = (node: StructureNode) => {
    if (isSide(node) || node.children.length === 0) return
    open.add(node.path)
    node.children.forEach(visit)
  }
  root.children.forEach(visit)
  return open
}

/** 주요 폴더로 치는 기준. 파일이 이만큼은 있고, 전체에서 이 비율은 넘어야 펼쳐요. */
const MAIN_MIN_FILES = 8
const MAIN_MIN_SHARE = 0.04

/** 코드가 든 폴더 중에서도 덩치가 큰 것만 펼쳐요. 파일 몇 개짜리 자잘한 폴더는 접어 둬서 큰 줄기만 보여요. */
function mainFolders(root: StructureNode): Set<string> {
  const open = new Set<string>()
  const least = Math.max(MAIN_MIN_FILES, root.files * MAIN_MIN_SHARE)
  const visit = (node: StructureNode) => {
    if (isSide(node) || node.children.length === 0 || node.files < least) return
    open.add(node.path)
    node.children.forEach(visit)
  }
  root.children.forEach(visit)
  return open
}

/** 하위 폴더가 있는 폴더 전부예요. */
function allFolders(root: StructureNode): Set<string> {
  const open = new Set<string>()
  const visit = (node: StructureNode) => {
    if (node.children.length === 0) return
    open.add(node.path)
    node.children.forEach(visit)
  }
  root.children.forEach(visit)
  return open
}

const PEOPLE_PREFIX = 'whoisloafing:deep:v2:'

/** 참여자 자료는 받는 데 오래 걸려서, 한 번 받으면 이 기기에 저장해 둬요. */
const readPeople = (repo: string) => readJson<FolderPerson[] | null>(`${PEOPLE_PREFIX}${repo.toLowerCase()}:people`, null)

const writePeople = (repo: string, people: FolderPerson[]) => writeJson(`${PEOPLE_PREFIX}${repo.toLowerCase()}:people`, people)

const ROLES_HIDDEN_KEY = 'whoisloafing:deep-map-roles-hidden'

const rolesHidden = () => readFlag(ROLES_HIDDEN_KEY)

/** 가지가 뻗는 방향. 가로는 왼쪽에서 오른쪽으로, 세로는 위에서 아래로 뻗어요. */
type Direction = 'horizontal' | 'vertical'

const DIRECTION_KEY = 'whoisloafing:deep-map-direction'

const savedDirection = (): Direction => (readItem(DIRECTION_KEY) === 'vertical' ? 'vertical' : 'horizontal')

/** 사용자가 칸을 끌어서 옮긴 거리. 폴더 경로마다 따로 적어 둬요. */
type Moves = Record<string, { x: number; y: number }>

const MOVES_PREFIX = 'whoisloafing:deep-map-moves:'

/** 옮겨 둔 배치는 레포와 방향마다 이 기기에 저장해요. 다음에 열어도 그대로 보여요. */
const movesKey = (repo: string, direction: Direction) => `${MOVES_PREFIX}${repo.toLowerCase()}:${direction}`

const readMoves = (repo: string, direction: Direction) => readJson<Moves>(movesKey(repo, direction), {})

function writeMoves(repo: string, direction: Direction, moves: Moves) {
  const key = movesKey(repo, direction)
  if (Object.keys(moves).length === 0) writeItem(key, null)
  else writeJson(key, moves)
}

/** 맵 위에 그린 그림 하나. 좌표는 맵 기준이라, 맵을 옮기거나 키우면 같이 따라가요. 저장하지 않아서 화면을 떠나면 사라져요. */
type Shape = { kind: 'pen'; points: [number, number][] } | { kind: 'rect' | 'ellipse'; x: number; y: number; w: number; h: number }

/**
 * 지금 고른 도구. select는 칸을 누르고 옮기고, 빈 곳을 끌어서 여러 칸을 한꺼번에 고르는 평소 상태예요.
 * hand는 어디를 끌어도 맵이 움직이고, 나머지는 맵 위에 그림을 그려요.
 */
type Tool = 'select' | 'hand' | 'pen' | 'rect' | 'ellipse'
const DRAW_TOOLS: Tool[] = ['pen', 'rect', 'ellipse']

/** 되돌리기에 쓰는 한 시점의 모습 */
interface Snapshot {
  moves: Moves
  shapes: Shape[]
}

/** 자동으로 잡은 자리에 사용자가 옮긴 거리를 더해요. 폴더를 옮기면 그 아래 가지도 같이 따라가요. */
function applyMoves(placed: Placed[], moves: Moves): Placed[] {
  const shifted = new Map<Placed, Placed>()
  const total = new Map<Placed, { x: number; y: number }>()
  return placed.map((item) => {
    const own = moves[item.node.path]
    const above = item.parent ? total.get(item.parent)! : { x: 0, y: 0 }
    const sum = { x: above.x + (own?.x ?? 0), y: above.y + (own?.y ?? 0) }
    total.set(item, sum)
    const next: Placed = { ...item, x: item.x + sum.x, y: item.y + sum.y, parent: item.parent ? shifted.get(item.parent)! : null }
    shifted.set(item, next)
    return next
  })
}

/**
 * 펼쳐 둔 폴더만 나무 모양으로 자리를 잡아요. 가로로 뻗을 때는 깊이가 오른쪽으로, 형제가 아래로 늘어서고,
 * 세로로 뻗을 때는 깊이가 아래로, 형제가 옆으로 늘어서요. 부모는 자식들의 가운데에 와요.
 */
function layout(root: StructureNode, open: Set<string>, nodeH: number, direction: Direction): Placed[] {
  const placed: Placed[] = []
  const vertical = direction === 'vertical'
  // along은 깊이가 늘어나는 쪽, across는 형제가 늘어서는 쪽이에요.
  const alongStep = vertical ? nodeH + LEVEL_GAP : NODE_W + COL_GAP
  const acrossStep = vertical ? NODE_W + SIDE_GAP : nodeH + ROW_GAP
  let cursor = 0

  function place(node: StructureNode, depth: number, parent: Placed | null): Placed {
    const item: Placed = { node, x: 0, y: 0, depth, parent }
    placed.push(item)
    const expanded = depth === 0 || open.has(node.path)
    const children = expanded ? node.children.map((child) => place(child, depth + 1, item)) : []
    let across: number
    if (children.length === 0) {
      across = cursor
      cursor += acrossStep
    } else {
      const first = children[0]
      const last = children[children.length - 1]
      across = vertical ? (first.x + last.x) / 2 : (first.y + last.y) / 2
    }
    item.x = vertical ? across : depth * alongStep
    item.y = vertical ? depth * alongStep : across
    return item
  }

  place(root, 0, null)
  return placed
}

/**
 * 프로젝트 구조를 마인드맵처럼 둘러보는 화면이에요.
 * 레포에서 최상위 폴더로, 폴더에서 하위 폴더로 가지가 뻗어요. 보기 메뉴에서 오른쪽으로 뻗을지 아래로 뻗을지 골라요. 폴더를 누르면 가지가 펼쳐지고 접혀요.
 * 빈 곳을 끌거나 두 손가락으로 밀면 맵이 움직이고, 두 손가락을 벌리거나 오른쪽 위의 버튼을 누르면 커지고 작아져요.
 * 칸을 끌면 그 칸과 아래 가지를 마음대로 옮길 수 있고, 배치 되돌리기로 원래 자리에 돌려놔요.
 */
export function StructureMap({ name, repo, root }: Props) {
  const L = useMessages(TEXT)
  const [open, setOpen] = useState<Set<string>>(() => sourceFolders(root))
  /** 메뉴에서 고른 펼침 방식. 폴더를 직접 눌러서 바꾸면 어느 것도 아니게 돼요. */
  const [mode, setMode] = useState<'main' | 'source' | 'all' | 'none' | null>('source')
  const [selected, setSelected] = useState<string | null>(null)
  const [view, setView] = useState({ x: 24, y: 24, k: 1 })
  /** 처음 그릴 때는 가지가 뿌리에서부터 차례로 뻗어 나오게, 깊은 칸일수록 조금 늦게 나타나요. 그 뒤에 펼친 칸은 바로 나타나요. */
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(true), 900)
    return () => window.clearTimeout(timer)
  }, [])
  const appearDelay = (depth: number) => (settled ? undefined : `${Math.min(depth, 8) * 55}ms`)
  const frameRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  /** 끌고 있는 칸. 칸을 누른 채로 움직이면 맵이 아니라 그 칸이 움직여요. */
  const nodeDrag = useRef<{ paths: string[]; x: number; y: number; moved: boolean } | null>(null)
  /** 방금 끌어서 옮겼으면, 손을 뗄 때 따라오는 클릭을 한 번 무시해요. */
  const suppressClick = useRef(false)
  /** 폴더를 펼치거나 접을 때, 누른 칸이 화면에서 제자리에 있도록 기억해 두는 값 */
  const anchor = useRef<{ key: string; x: number; y: number } | null>(null)
  /** 가지가 뻗는 방향. 다음에 열어도 그대로 둬요. */
  const [direction, setDirection] = useState<Direction>(savedDirection)
  const vertical = direction === 'vertical'

  /** 폴더 이름 아래의 설명을 보여줄지. 숨기면 칸이 낮아져서 한 화면에 더 많이 들어와요. */
  const [roles, setRoles] = useState(() => !rolesHidden())
  const nodeH = roles ? NODE_H : NODE_H_COMPACT
  /** 펼친 폴더를 한꺼번에 바꾼 뒤에는 맵을 다시 화면에 맞춰요. */
  const refit = useRef(false)

  /** 참여자별 보기. 저장해 둔 것이 없으면 메뉴를 처음 열 때 받아요. 커밋을 하나씩 읽어서 시간이 걸려요. */
  const [people, setPeople] = useState<FolderPerson[] | 'loading' | { error: string } | null>(() => readPeople(repo))
  const [personId, setPersonId] = useState<string | null>(null)
  const person = Array.isArray(people) ? (people.find((item) => item.id === personId) ?? null) : null
  /** 고른 사람이 가장 많이 고친 최상위 폴더의 횟수. 색의 진하기를 정하는 기준이에요. */
  const personMax = person ? Math.max(1, ...root.children.map((node) => person.folders[node.path] ?? 0)) : 1

  async function loadPeople() {
    if (people !== null && (people === 'loading' || Array.isArray(people))) return
    setPeople('loading')
    const result = await fetchDeepReport(repo, 'people')
    if ('error' in result) {
      setPeople({ error: result.error })
      return
    }
    const list = result.report.people ?? []
    writePeople(repo, list)
    setPeople(list)
  }

  /**
   * 한 사람을 고르면 그 사람이 고친 폴더에 색을 입혀요. 같은 사람을 다시 고르면 풀어요.
   * 보던 맵은 그대로 두고, 그 사람이 고친 폴더 중 접혀 있던 것만 더 펼쳐요. 뿌리 칸은 화면에서 움직이지 않아요.
   */
  function pickPerson(next: FolderPerson | null) {
    const picked = next && next.id !== personId ? next : null
    setPersonId(picked?.id ?? null)
    track('deep_person_select', { repo, picked: picked !== null })
    if (!picked) return
    const added = new Set(open)
    const visit = (node: StructureNode) => {
      if (node.children.length === 0 || !picked.folders[node.path]) return
      added.add(node.path)
      node.children.forEach(visit)
    }
    root.children.forEach(visit)
    if (added.size === open.size) return
    anchor.current = { key: base[0].node.path, x: base[0].x, y: base[0].y }
    setMode(null)
    setOpen(added)
  }

  /** 사용자가 끌어서 옮긴 칸들. 방향마다 따로 기억해요. */
  const [moves, setMoves] = useState<Moves>(() => readMoves(repo, savedDirection()))
  const arranged = Object.keys(moves).length > 0
  /** 칸을 옮기기 전의 배치들. Command Z로 하나씩 되돌리고, Shift를 같이 누르면 다시 돌려놔요. */
  const undoStack = useRef<Snapshot[]>([])
  const redoStack = useRef<Snapshot[]>([])
  /** 끌기 시작했을 때의 배치. 손을 뗄 때 되돌리기 기록에 넣어요. */
  const beforeDrag = useRef<Moves | null>(null)
  /** 펜이나 도형으로 맵 위에 그린 그림. 저장하지 않고, 이 화면에 있는 동안만 남아요. */
  const [shapes, setShapes] = useState<Shape[]>([])
  const [tool, setTool] = useState<Tool>('select')
  /** 스페이스바를 누르고 있는 동안에는 어떤 도구를 골랐든 잠깐 손 도구가 돼요. 떼면 고른 도구로 돌아와요. */
  const [spaceHeld, setSpaceHeld] = useState(false)
  const using: Tool = spaceHeld ? 'hand' : tool
  const drawingTool = DRAW_TOOLS.includes(using)

  useEffect(() => {
    // 맵 안이나 아무것도 고르지 않은 곳에서 누른 스페이스바만 받아요. 글자를 입력하는 중이나 확인 창이 떠 있을 때는 받지 않아요.
    const ours = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.metaKey || event.ctrlKey || event.altKey) return false
      if (document.querySelector('[aria-modal="true"]')) return false
      const target = event.target
      if (!(target instanceof Element)) return true
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return false
      return target === document.body || frameRef.current?.contains(target) === true
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!ours(event)) return
      // 화면이 밀리거나, 방금 누른 버튼이 다시 눌리지 않게 막아요.
      event.preventDefault()
      if (!event.repeat) setSpaceHeld(true)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      if (ours(event)) event.preventDefault()
      setSpaceHeld(false)
    }
    const release = () => setSpaceHeld(false)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', release)
    }
  }, [])
  /** 빈 곳을 끌어서 한꺼번에 고른 칸들. 그중 하나를 끌면 같이 움직여요. */
  const [picked, setPicked] = useState<Set<string>>(() => new Set())
  /** 끌어서 고르는 동안 보이는 네모. 맵 기준 좌표예요. */
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const marqueeStart = useRef<[number, number] | null>(null)
  /** 지금 그리고 있는 그림. 손을 떼면 shapes에 들어가요. */
  const [drawing, setDrawing] = useState<Shape | null>(null)
  const drawStart = useRef<[number, number] | null>(null)
  // 자동으로 잡은 자리예요. 펼치고 접을 때 누른 칸을 제자리에 두는 계산은 이 자리로 해요.
  const base = useMemo(() => layout(root, open, nodeH, direction), [root, open, nodeH, direction])
  const placed = useMemo(() => applyMoves(base, moves), [base, moves])
  const keyOf = (item: Placed) => item.node.path
  const width = Math.max(...placed.map((item) => item.x)) + NODE_W
  const height = Math.max(...placed.map((item) => item.y)) + nodeH

  /** 맵 전체가 화면에 들어오게 맞춰요. 작은 맵을 억지로 키우지는 않아요. */
  const rootX = placed[0].x
  const rootY = placed[0].y
  const fit = useCallback(
    (floor = MIN_ZOOM) => {
      const frame = frameRef.current
      if (!frame) return
      const pad = 32
      const k = Math.min(1, Math.max(floor, Math.min((frame.clientWidth - pad * 2) / width, (frame.clientHeight - pad * 2) / height)))
      // 다 들어오지 않을 만큼 크면, 가지가 시작되는 뿌리 칸이 화면 가운데에 오게 해요. 가로로 뻗을 때는 가운데 높이에, 세로로 뻗을 때는 가운데 폭에 둬요.
      if (vertical) {
        const fits = width * k <= frame.clientWidth - pad * 2
        // 위쪽에는 메뉴 버튼이 떠 있어서 그만큼 더 띄워요.
        setView({ k, x: fits ? (frame.clientWidth - width * k) / 2 : frame.clientWidth / 2 - (rootX + NODE_W / 2) * k, y: pad + 44 })
        return
      }
      const fits = height * k <= frame.clientHeight - pad * 2
      setView({ k, x: pad, y: fits ? (frame.clientHeight - height * k) / 2 : frame.clientHeight / 2 - (rootY + nodeH / 2) * k })
    },
    [width, height, rootX, rootY, nodeH, vertical],
  )

  // 처음 그릴 때 한 번만 화면에 맞춰요. 그 뒤로는 보던 자리를 그대로 둬요.
  const fitted = useRef(false)
  useLayoutEffect(() => {
    if (fitted.current) return
    fitted.current = true
    // 처음에는 글자를 읽을 수 있는 크기까지만 줄여요. 전체는 한눈에 보기로 볼 수 있어요.
    fit(READABLE_ZOOM)
  }, [fit])

  useLayoutEffect(() => {
    if (!refit.current) return
    refit.current = false
    fit(READABLE_ZOOM)
  }, [placed, fit])

  function showFolders(next: Set<string>, picked: 'main' | 'source' | 'all' | 'none') {
    refit.current = true
    setSelected(null)
    setMode(picked)
    setOpen(next)
  }

  function changeDirection(next: Direction) {
    if (next === direction) return
    track('deep_map_direction', { repo, direction: next })
    refit.current = true
    setDirection(next)
    setMoves(readMoves(repo, next))
    // 방향마다 배치가 따로라서, 되돌리기 기록도 새로 시작해요.
    undoStack.current = []
    redoStack.current = []
    writeItem(DIRECTION_KEY, next === 'vertical' ? 'vertical' : null)
  }

  /** 끌어서 옮긴 칸을 모두 원래 자리로 돌려놔요. */
  function resetMoves() {
    track('deep_map_reset', { repo })
    undoStack.current.push({ moves, shapes })
    redoStack.current = []
    refit.current = true
    setMoves({})
    writeMoves(repo, direction, {})
  }

  /** 그린 그림을 모두 지워요. */
  function clearShapes() {
    track('deep_map_draw_clear', { repo })
    undoStack.current.push({ moves, shapes })
    redoStack.current = []
    setShapes([])
  }

  function pickTool(next: Tool) {
    if (next !== tool) track('deep_map_tool', { repo, tool: next })
    // 그리는 도구를 다시 누르면 평소의 선택 도구로 돌아가요.
    setTool((prev) => (prev === next && DRAW_TOOLS.includes(next) ? 'select' : next))
  }

  /** 화면에서 누른 자리를 맵 기준 좌표로 바꿔요. */
  function toMap(event: { clientX: number; clientY: number }): [number, number] {
    const rect = frameRef.current!.getBoundingClientRect()
    return [(event.clientX - rect.left - view.x) / view.k, (event.clientY - rect.top - view.y) / view.k]
  }

  /** 칸을 옮기거나, 그림을 그리거나 지우거나, 배치를 되돌린 것을 한 단계 무르거나(undo), 무른 것을 다시 해요(redo). */
  function stepMoves(kind: 'undo' | 'redo') {
    const from = kind === 'undo' ? undoStack.current : redoStack.current
    const to = kind === 'undo' ? redoStack.current : undoStack.current
    const target = from.pop()
    if (!target) return
    to.push({ moves, shapes })
    track('deep_map_undo', { repo, kind })
    setMoves(target.moves)
    setShapes(target.shapes)
    writeMoves(repo, direction, target.moves)
  }

  // Command Z(Windows는 Ctrl Z)로 옮긴 칸을 되돌려요. 글자를 입력하는 중이나 확인 창이 떠 있을 때는 받지 않아요.
  const step = useRef(stepMoves)
  step.current = stepMoves
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.code !== 'KeyZ') return
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) return
      if (document.querySelector('[aria-modal="true"]')) return
      event.preventDefault()
      step.current(event.shiftKey ? 'redo' : 'undo')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function toggleRoles() {
    const next = !roles
    refit.current = true
    setRoles(next)
    writeFlag(ROLES_HIDDEN_KEY, !next)
  }

  // 펼치거나 접으면 다른 칸들의 자리가 바뀌어요. 누른 칸은 화면에서 움직이지 않게 맵을 그만큼 옮겨요.
  useLayoutEffect(() => {
    const kept = anchor.current
    if (!kept) return
    anchor.current = null
    const now = base.find((item) => keyOf(item) === kept.key)
    if (now && (now.x !== kept.x || now.y !== kept.y)) setView((prev) => ({ ...prev, x: prev.x + (kept.x - now.x) * prev.k, y: prev.y + (kept.y - now.y) * prev.k }))
  }, [base])

  const zoomAt = useCallback((factor: number, originX: number, originY: number) => {
    setView((prev) => {
      const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.k * factor))
      const ratio = k / prev.k
      return { k, x: originX - (originX - prev.x) * ratio, y: originY - (originY - prev.y) * ratio }
    })
  }, [])

  // 두 손가락으로 밀면 맵이 움직이고, 벌리면(브라우저가 ctrl과 함께 알려줘요) 커져요. 화면 자체가 밀리지 않게 막아야 해서 직접 붙여요.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      if (event.ctrlKey || event.metaKey) {
        const rect = frame.getBoundingClientRect()
        zoomAt(Math.exp(-event.deltaY * 0.01), event.clientX - rect.left, event.clientY - rect.top)
      } else {
        setView((prev) => ({ ...prev, x: prev.x - event.deltaX, y: prev.y - event.deltaY }))
      }
    }
    frame.addEventListener('wheel', onWheel, { passive: false })
    return () => frame.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    // 선택 도구로 빈 곳을 끌면 네모가 그려지고, 그 안에 든 칸들이 한꺼번에 골라져요.
    if (using === 'select') {
      marqueeStart.current = toMap(event)
      return
    }
    // 펜이나 도형을 고른 동안에는 맵을 미는 대신 그림을 그려요.
    if (using === 'pen' || using === 'rect' || using === 'ellipse') {
      const [x, y] = toMap(event)
      drawStart.current = [x, y]
      setDrawing(using === 'pen' ? { kind: 'pen', points: [[x, y]] } : { kind: using, x, y, w: 0, h: 0 })
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    drag.current = { x: event.clientX, y: event.clientY, moved: false }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = drawStart.current
    if (start) {
      const [x, y] = toMap(event)
      setDrawing((prev) => {
        if (!prev) return prev
        if (prev.kind === 'pen') return { kind: 'pen', points: [...prev.points, [x, y]] }
        return { kind: prev.kind, x: Math.min(start[0], x), y: Math.min(start[1], y), w: Math.abs(x - start[0]), h: Math.abs(y - start[1]) }
      })
      return
    }
    const corner = marqueeStart.current
    if (corner) {
      const [x, y] = toMap(event)
      if (!marquee && Math.hypot(x - corner[0], y - corner[1]) * view.k < DRAG_PX) return
      if (!marquee) event.currentTarget.setPointerCapture(event.pointerId)
      const box = { x: Math.min(corner[0], x), y: Math.min(corner[1], y), w: Math.abs(x - corner[0]), h: Math.abs(y - corner[1]) }
      setMarquee(box)
      // 끄는 동안에도 네모에 조금이라도 걸친 칸을 바로바로 골라서, 무엇이 골라지는지 보이게 해요.
      const inside = placed.filter((item) => item.x < box.x + box.w && item.x + NODE_W > box.x && item.y < box.y + box.h && item.y + nodeH > box.y)
      setPicked(new Set(inside.map((item) => item.node.path)))
      return
    }
    const held = nodeDrag.current
    if (held) {
      const dx = event.clientX - held.x
      const dy = event.clientY - held.y
      if (!held.moved && Math.hypot(dx, dy) < DRAG_PX) return
      if (!held.moved) {
        event.currentTarget.setPointerCapture(event.pointerId)
        beforeDrag.current = moves
      }
      nodeDrag.current = { ...held, x: event.clientX, y: event.clientY, moved: true }
      // 화면에서 움직인 만큼을 맵의 배율로 나눠서, 확대해 둔 상태에서도 손가락을 그대로 따라오게 해요.
      setMoves((prev) => {
        const next = { ...prev }
        for (const path of held.paths) {
          const now = prev[path] ?? { x: 0, y: 0 }
          next[path] = { x: now.x + dx / view.k, y: now.y + dy / view.k }
        }
        return next
      })
      return
    }
    const state = drag.current
    if (!state) return
    const dx = event.clientX - state.x
    const dy = event.clientY - state.y
    if (!state.moved && Math.hypot(dx, dy) < DRAG_PX) return
    if (!state.moved) event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, y: event.clientY, moved: true }
    setView((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
  }

  function toggle(item: Placed) {
    setSelected(item.node.path)
    if (item.depth === 0 || item.node.children.length === 0) return
    const auto = base.find((other) => keyOf(other) === keyOf(item)) ?? item
    anchor.current = { key: keyOf(item), x: auto.x, y: auto.y }
    setMode(null)
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(item.node.path)) {
        // 접을 때는 그 아래에 펼쳐 둔 폴더도 같이 접어요.
        for (const path of next) if (path === item.node.path || path.startsWith(`${item.node.path}/`)) next.delete(path)
      } else {
        next.add(item.node.path)
      }
      return next
    })
  }

  const focus = placed.find((item) => item.node.path === selected && item.depth > 0)
  const zoomBy = (factor: number) => {
    const frame = frameRef.current
    if (frame) zoomAt(factor, frame.clientWidth / 2, frame.clientHeight / 2)
  }

  useShortcuts({
    Equal: () => zoomBy(1.25),
    'Shift+Equal': () => zoomBy(1.25),
    NumpadAdd: () => zoomBy(1.25),
    Minus: () => zoomBy(1 / 1.25),
    NumpadSubtract: () => zoomBy(1 / 1.25),
    Digit0: () => fit(),
    KeyM: () => showFolders(mainFolders(root), 'main'),
    KeyS: () => showFolders(sourceFolders(root), 'source'),
    KeyE: () => showFolders(allFolders(root), 'all'),
    KeyW: () => showFolders(new Set(), 'none'),
    KeyI: toggleRoles,
    KeyL: () => changeDirection(vertical ? 'horizontal' : 'vertical'),
    // 도구의 키는 피그마와 같아요.
    KeyV: () => pickTool('select'),
    KeyH: () => pickTool('hand'),
    KeyP: () => pickTool('pen'),
    KeyR: () => pickTool('rect'),
    KeyO: () => pickTool('ellipse'),
    KeyX: shapes.length > 0 ? clearShapes : undefined,
  })

  return (
    <div
      ref={frameRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => {
        if (marqueeStart.current) {
          marqueeStart.current = null
          if (marquee) {
            // 고른 칸은 끄는 동안 이미 정해졌어요. 네모만 치워요.
            setMarquee(null)
            suppressClick.current = true
            window.setTimeout(() => (suppressClick.current = false), 0)
          }
          return
        }
        if (drawStart.current) {
          drawStart.current = null
          // 점 하나만 찍힌 것처럼 너무 작은 그림은 남기지 않아요.
          const drawn = drawing && (drawing.kind === 'pen' ? drawing.points.length > 2 : drawing.w > 4 || drawing.h > 4) ? drawing : null
          setDrawing(null)
          suppressClick.current = true
          window.setTimeout(() => (suppressClick.current = false), 0)
          if (drawn) {
            undoStack.current.push({ moves, shapes })
            redoStack.current = []
            setShapes([...shapes, drawn])
          }
          return
        }
        // 끌어서 옮긴 직후의 클릭은 칸을 누른 것으로 치지 않아요.
        suppressClick.current = drag.current?.moved === true || nodeDrag.current?.moved === true
        if (nodeDrag.current?.moved) {
          track('deep_map_move', { repo })
          writeMoves(repo, direction, moves)
          if (beforeDrag.current) undoStack.current.push({ moves: beforeDrag.current, shapes })
          redoStack.current = []
          beforeDrag.current = null
        }
        nodeDrag.current = null
        drag.current = null
        if (suppressClick.current) window.setTimeout(() => (suppressClick.current = false), 0)
      }}
      onPointerCancel={() => {
        drag.current = null
        nodeDrag.current = null
        drawStart.current = null
        setDrawing(null)
        marqueeStart.current = null
        setMarquee(null)
      }}
      onClick={(event) => {
        // 칸이나 버튼이 아닌 빈 곳을 누르면 골라 둔 폴더의 설명을 닫아요.
        if (!suppressClick.current && !(event.target as HTMLElement).closest('button, aside')) {
          setSelected(null)
          setPicked(new Set())
        }
      }}
      className="relative h-full touch-none overflow-hidden bg-gray-50 select-none"
      style={{ cursor: using === 'hand' ? 'grab' : drawingTool ? 'crosshair' : 'default' }}
    >
      <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, width, height }}>
        <svg width={width} height={height} className="absolute top-0 left-0 overflow-visible text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          {placed.map((item) => {
            if (!item.parent) return null
            if (vertical) {
              // 부모 칸의 아래 가운데에서 자식 칸의 위 가운데로 이어요.
              const fromX = item.parent.x + NODE_W / 2
              const fromY = item.parent.y + nodeH
              const toX = item.x + NODE_W / 2
              const mid = (fromY + item.y) / 2
              return <path key={keyOf(item)} className="animate-fade" style={{ animationDelay: appearDelay(item.depth) }} d={`M${fromX} ${fromY} C${fromX} ${mid}, ${toX} ${mid}, ${toX} ${item.y}`} />
            }
            const fromX = item.parent.x + NODE_W
            const fromY = item.parent.y + nodeH / 2
            const toY = item.y + nodeH / 2
            const mid = (fromX + item.x) / 2
            return <path key={keyOf(item)} className="animate-fade" style={{ animationDelay: appearDelay(item.depth) }} d={`M${fromX} ${fromY} C${mid} ${fromY}, ${mid} ${toY}, ${item.x} ${toY}`} />
          })}
        </svg>

        {placed.map((item) => {
          const style = { left: item.x, top: item.y, width: NODE_W, height: nodeH }
          const { node } = item
          const isRoot = item.depth === 0
          const expandable = !isRoot && node.children.length > 0
          const expanded = open.has(node.path)
          const active = selected === node.path && !isRoot
          const total = item.parent?.node.files ?? node.files
          // 참여자별 보기에서는 고친 횟수가 많을수록 칸이 진해지고, 손대지 않은 폴더는 흐려져요.
          const touched = person && !isRoot ? (person.folders[node.path] ?? 0) : null
          const heat = touched ? Math.min(1, touched / personMax) : 0
          const tint =
            touched && !active && !picked.has(node.path) ? { backgroundColor: `color-mix(in srgb, var(--color-brand) ${Math.round(8 + heat * 34)}%, var(--color-white))`, borderColor: 'var(--color-brand)' } : undefined
          return (
            <button
              key={keyOf(item)}
              type="button"
              data-no-press
              style={{ ...style, ...tint, opacity: touched === 0 ? 0.4 : undefined, animationDelay: appearDelay(item.depth) }}
              aria-expanded={expandable ? expanded : undefined}
              onPointerDown={(event) => {
                // 칸을 누른 채로 끌면 맵 대신 이 칸이 움직여요. 뿌리 칸을 끌면 맵 전체가 따라와요.
                // 손 도구로는 칸 위에서도 맵이 움직이고, 펜이나 도형을 고른 동안에는 칸 위에서도 그림을 그려요.
                if (event.button !== 0 || using !== 'select') return
                event.stopPropagation()
                // 여러 칸을 골라 둔 상태에서 그중 하나를 끌면 같이 움직여요. 위 폴더가 같이 골라져 있으면 아래 가지는 따라가니 따로 옮기지 않아요.
                const group = picked.has(node.path) ? [...picked].filter((path) => ![...picked].some((other) => other !== path && (other === '' || path.startsWith(`${other}/`)))) : [node.path]
                nodeDrag.current = { paths: group, x: event.clientX, y: event.clientY, moved: false }
              }}
              onClick={() => {
                if (!suppressClick.current) toggle(item)
              }}
              className={`absolute flex animate-pop items-center gap-2 overflow-hidden rounded-xl border pr-2.5 pl-3 text-left transition-colors ${
                isRoot
                  ? 'border-brand bg-brand text-white'
                  : active || picked.has(node.path)
                    ? 'border-brand bg-brand-soft text-gray-900'
                    : 'border-gray-200 bg-white text-gray-900 hover:border-brand'
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-[13px] font-semibold tracking-normal">{isRoot ? name : node.name}</span>
                {roles && (
                  <span className={`block truncate text-[11.5px] ${isRoot ? 'text-white/70' : 'text-gray-500'}`}>
                    {isRoot ? L.files(count(node.files)) : (node.role ?? L.files(count(node.files)))}
                  </span>
                )}
              </span>
              {!isRoot && (
                <span className={`flex shrink-0 gap-1 ${roles ? 'flex-col items-end' : 'items-center'}`}>
                  <span className={`text-[11px] tabular-nums ${touched ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                    {touched !== null ? L.times(count(touched)) : count(node.files)}
                  </span>
                  {expandable && (
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className={`size-3 text-gray-400 transition-transform ${vertical ? (expanded ? '-rotate-90' : 'rotate-90') : expanded ? 'rotate-180' : ''}`} aria-hidden="true">
                      <path d="M6 3.5L10.5 8 6 12.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
              )}
              {/* 같은 부모 아래에서 이 폴더가 차지하는 비율을 칸 아래의 가는 선으로 보여줘요. */}
              {!isRoot && (
                <span className="absolute bottom-0 left-0 h-[3px] bg-brand" style={{ width: `${Math.max(3, (node.files / Math.max(1, total)) * 100)}%`, opacity: 0.55 }} aria-hidden="true" />
              )}
            </button>
          )
        })}
        {/* 펜과 도형으로 그린 그림이에요. 칸 위에 얹히고, 누르는 것을 가로막지 않아요. */}
        <svg width={width} height={height} className="pointer-events-none absolute top-0 left-0 overflow-visible text-brand" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {marquee && <rect x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h} rx="4" strokeWidth={1.5 / view.k} strokeDasharray={`${5 / view.k} ${4 / view.k}`} fill="currentColor" fillOpacity="0.06" />}
          {[...shapes, ...(drawing ? [drawing] : [])].map((shape, index) =>
            shape.kind === 'pen' ? (
              <polyline key={index} points={shape.points.map(([x, y]) => `${x},${y}`).join(' ')} />
            ) : shape.kind === 'rect' ? (
              <rect key={index} x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx="8" />
            ) : (
              <ellipse key={index} cx={shape.x + shape.w / 2} cy={shape.y + shape.h / 2} rx={shape.w / 2} ry={shape.h / 2} />
            ),
          )}
        </svg>
      </div>

      {focus && (
        <aside
          onPointerDown={(event) => event.stopPropagation()}
          className="absolute bottom-4 left-4 w-72 origin-bottom-left animate-pop cursor-default rounded-xl border border-gray-200 bg-white p-4 select-text"
        >
          <p className="font-mono text-[12.5px] font-semibold tracking-normal break-all text-gray-900">{focus.node.path}</p>
          {focus.node.role && <p className="mt-1 text-[12.5px] leading-snug text-gray-600">{focus.node.role}</p>}
          <p className="mt-2 text-[12px] text-gray-500 tabular-nums">
            {L.share(count(focus.node.files), Math.round((focus.node.files / Math.max(1, root.files)) * 100))}
          </p>
          {person && (
            <p className="mt-1 text-[12px] text-gray-500 tabular-nums">
              {L.edited(person.name, count(person.folders[focus.node.path] ?? 0))}
            </p>
          )}
          {focus.node.samples && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {focus.node.samples.map((file) => (
                <span key={file} className={`${tag} font-mono tracking-normal`}>
                  {file}
                </span>
              ))}
            </div>
          )}
        </aside>
      )}

      <div onPointerDown={(event) => event.stopPropagation()} className="absolute top-4 left-4 flex cursor-default items-center gap-2">
        <MapMenu
          label={L.view}
          groups={[
            {
              title: L.folders,
              items: [
                { label: L.main, shortcut: 'M', checked: mode === 'main', onSelect: () => showFolders(mainFolders(root), 'main') },
                { label: L.source, shortcut: 'S', checked: mode === 'source', onSelect: () => showFolders(sourceFolders(root), 'source') },
                { label: L.expandAll, shortcut: 'E', checked: mode === 'all', onSelect: () => showFolders(allFolders(root), 'all') },
                { label: L.collapseAll, shortcut: 'W', checked: mode === 'none', onSelect: () => showFolders(new Set(), 'none') },
              ],
            },
            { title: L.display, items: [{ label: L.roles, shortcut: 'I', checked: roles, onSelect: toggleRoles }] },
          ]}
        />
        <MapMenu
          label={L.people}
          value={person?.name}
          active={person !== null}
          onOpen={() => void loadPeople()}
          groups={[
            {
              loading: people === null || people === 'loading',
              note: people !== null && people !== 'loading' && !Array.isArray(people) ? people.error : Array.isArray(people) && people.length === 0 ? L.noCommits : undefined,
              items: Array.isArray(people)
                ? [
                    { label: L.all, checked: person === null, onSelect: () => pickPerson(null) },
                    ...people.map((item) => ({
                      label: item.name,
                      hint: L.commits(count(item.commits)),
                      checked: item.id === personId,
                      onSelect: () => pickPerson(item),
                    })),
                  ]
                : [],
            },
          ]}
        />
      </div>

      {/* 맵을 다루는 버튼을 오른쪽 위에 한 줄로 모아 둬요. 가지가 뻗는 방향, 확대와 축소, 한눈에 보기 순서예요. */}
      <div onPointerDown={(event) => event.stopPropagation()} className="absolute top-4 right-4 flex cursor-default items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-1">
        <button
          type="button"
          aria-label={L.horizontal}
          aria-pressed={!vertical}
          onClick={() => changeDirection('horizontal')}
          className={`${control} ${vertical ? '' : chosen}`}
        >
          <Tip text={L.horizontal} keys="L" />
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" className="size-4" aria-hidden="true">
            <rect x="1.5" y="6" width="4" height="4" rx="1" />
            <rect x="10.5" y="2" width="4" height="4" rx="1" />
            <rect x="10.5" y="10" width="4" height="4" rx="1" />
            <path d="M5.5 8H8M10.5 4H9a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h1.5" />
          </svg>
        </button>
        <button
          type="button"
          aria-label={L.vertical}
          aria-pressed={vertical}
          onClick={() => changeDirection('vertical')}
          className={`${control} ${vertical ? chosen : ''}`}
        >
          <Tip text={L.vertical} keys="L" />
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" className="size-4" aria-hidden="true">
            <rect x="6" y="1.5" width="4" height="4" rx="1" />
            <rect x="2" y="10.5" width="4" height="4" rx="1" />
            <rect x="10" y="10.5" width="4" height="4" rx="1" />
            <path d="M8 5.5V8M4 10.5V9a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1.5" />
          </svg>
        </button>
        <span aria-hidden className="mx-1 h-5 w-px bg-gray-200" />
        {/* 선택 도구는 칸을 누르고 옮기고, 빈 곳을 끌어서 여러 칸을 골라요. 손 도구는 어디를 끌어도 맵이 움직여요. */}
        <button type="button" aria-label={L.select} aria-pressed={using === 'select'} onClick={() => pickTool('select')} className={`${control} ${using === 'select' ? chosen : ''}`}>
          <Tip text={L.select} keys="V" />
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" className="size-4" aria-hidden="true">
            <path d="M3.5 2.5l9 4.2-3.8 1.2-1.3 3.8z" />
          </svg>
        </button>
        <button type="button" aria-label={L.hand} aria-pressed={using === 'hand'} onClick={() => pickTool('hand')} className={`${control} ${using === 'hand' ? chosen : ''}`}>
          <Tip text={L.hand} keys="H" />
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
            <path d="M5.5 8V3.8a1 1 0 0 1 2 0V7M7.5 7V2.8a1 1 0 0 1 2 0V7M9.5 7V3.8a1 1 0 0 1 2 0M5.5 8.5L4.3 7.3a1 1 0 0 0-1.5 1.3l2.400 3.600a3.500 3.500 0 0 0 2.900 1.500h.9a3.500 3.500 0 0 0 3.500-3.500V4.800" />
          </svg>
        </button>
        {/* 맵 위에 그리는 도구예요. 고른 도구를 다시 누르면 선택 도구로 돌아가요. 그림은 저장하지 않아요. */}
        <button type="button" aria-label={L.pen} aria-pressed={tool === 'pen'} onClick={() => pickTool('pen')} className={`${control} ${tool === 'pen' ? chosen : ''}`}>
          <Tip text={L.pen} keys="P" />
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
            <path d="M10.5 3l2.5 2.5L5.5 13H3v-2.5zM9 4.5L11.5 7" />
          </svg>
        </button>
        <button type="button" aria-label={L.rect} aria-pressed={tool === 'rect'} onClick={() => pickTool('rect')} className={`${control} ${tool === 'rect' ? chosen : ''}`}>
          <Tip text={L.rect} keys="R" />
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" className="size-4" aria-hidden="true">
            <rect x="2.5" y="3.5" width="11" height="9" rx="1.5" />
          </svg>
        </button>
        <button type="button" aria-label={L.ellipse} aria-pressed={tool === 'ellipse'} onClick={() => pickTool('ellipse')} className={`${control} ${tool === 'ellipse' ? chosen : ''}`}>
          <Tip text={L.ellipse} keys="O" />
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="size-4" aria-hidden="true">
            <circle cx="8" cy="8" r="5.5" />
          </svg>
        </button>
        <button
          type="button"
          aria-label={L.clear}
          disabled={shapes.length === 0}
          onClick={clearShapes}
          className={`${control} disabled:text-gray-300 disabled:hover:bg-transparent`}
        >
          <Tip text={L.clear} keys="X" />
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
            <path d="M9.5 3L13 6.5l-6 6H4.5L3 11zM7 5.5L10.5 9M7 12.5h6" />
          </svg>
        </button>
        <span aria-hidden className="mx-1 h-5 w-px bg-gray-200" />
        {/* 끌어서 옮긴 칸이 있을 때만 눌러요. 모두 원래 자리로 돌려놔요. */}
        <button
          type="button"
          aria-label={L.reset}
          disabled={!arranged}
          onClick={resetMoves}
          className={`${controlBase} text-red-500 hover:text-red-600 disabled:text-gray-300 disabled:hover:bg-transparent`}
        >
          <Tip text={L.reset} />
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
            <path d="M3 8a5 5 0 1 0 1.5-3.57M3 3v2.5h2.5" />
          </svg>
        </button>
        <span aria-hidden className="mx-1 h-5 w-px bg-gray-200" />
        <button type="button" aria-label={L.smaller} onClick={() => zoomBy(1 / 1.25)} className={control}>
          <Tip text={L.zoomOut} keys="-" />
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="size-3.5" aria-hidden="true">
            <path d="M3.5 8h9" />
          </svg>
        </button>
        <span className="w-11 text-center text-[12.5px] text-gray-500 tabular-nums">{Math.round(view.k * 100)}%</span>
        <button type="button" aria-label={L.bigger} onClick={() => zoomBy(1.25)} className={control}>
          <Tip text={L.zoomIn} keys="+" />
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="size-3.5" aria-hidden="true">
            <path d="M3.5 8h9M8 3.5v9" />
          </svg>
        </button>
        {/* 네 모서리가 바깥으로 벌어진 그림이에요. 맵 전체를 화면에 맞춰요. */}
        <button type="button" aria-label={L.fit} onClick={() => fit()} className={control}>
          <Tip text={L.fit} keys="0" end />
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
            <path d="M6 2.5H2.5V6M10 2.5h3.5V6M6 13.5H2.5V10M10 13.5h3.5V10" />
          </svg>
        </button>
      </div>
    </div>
  )
}

/** 오른쪽 위 아이콘 버튼의 모양. 색은 따로 붙여요. */
const controlBase = 'group relative flex size-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100'
const control = `${controlBase} text-gray-600 hover:text-gray-900`

/**
 * 아이콘 버튼에 마우스를 올리거나 키보드로 고르면 바로 아래에 뜨는 설명이에요. 단축키가 있으면 옆에 같이 적어요.
 * 맨 오른쪽 버튼은 설명이 화면 밖으로 나가지 않게 오른쪽 끝에 맞춰요(end).
 */
function Tip({ text, keys, end = false }: { text: string; keys?: string; end?: boolean }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute top-full z-10 mt-2 flex items-center gap-1.5 rounded-md bg-gray-900/90 px-2 py-1 text-[11.5px] font-medium whitespace-nowrap text-white opacity-0 transition-opacity delay-150 group-hover:opacity-100 group-focus-visible:opacity-100 ${
        end ? 'right-0' : 'left-1/2 -translate-x-1/2'
      }`}
    >
      {text}
      {keys && <span className="rounded-[4px] border border-white/30 px-1 text-[10.5px] leading-[1.4]">{keys}</span>}
    </span>
  )
}
/** 지금 고른 방향의 버튼 */
const chosen = 'bg-gray-100 text-gray-900'
