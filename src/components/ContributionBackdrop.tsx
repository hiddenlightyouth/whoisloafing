import { useEffect, useRef } from 'react'

const CELL = 14
const GAP = 5
const STEP = CELL + GAP
const BRAND = '46, 144, 250'

/** 지렁이가 한 칸 움직이는 데 걸리는 시간 */
const WORM_STEP_MS = 320
const WORM_LENGTH = 7

interface Cell {
  x: number
  y: number
  level: number
  phase: number
  speed: number
  /** 지렁이가 지나가면서 먹은 칸은 이 시각까지 꺼져 있어요. */
  eatenUntil: number
}

interface Worm {
  /** 머리부터 꼬리 순서의 칸 좌표 */
  body: { col: number; row: number }[]
  direction: { col: number; row: number }
  next: { col: number; row: number }
  /** 다음 칸으로 넘어가는 중인 정도 (0에서 1) */
  progress: number
}

const DIRECTIONS = [
  { col: 1, row: 0 },
  { col: -1, row: 0 },
  { col: 0, row: 1 },
  { col: 0, row: -1 },
]

/**
 * 메인 화면 뒤에 깔리는 배경이에요. GitHub 기여도 그래프처럼 생긴 작은 칸들이 옅게 반짝이고,
 * 그 위를 지렁이 몇 마리가 칸을 따라 기어다니면서 켜진 칸을 먹어요.
 * 가운데 타이틀과 입력창 주변은 옅게만 보여서, 반투명한 입력창 뒤로 흐릿하게 지나가요.
 */
export function ContributionBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let cells = new Map<string, Cell>()
    let worms: Worm[] = []
    let cols = 0
    let rows = 0
    let offsetX = 0
    let offsetY = 0
    let width = 0
    let height = 0
    let frame = 0
    let last = 0

    const key = (col: number, row: number) => `${col},${row}`
    const centerOf = (col: number, row: number) => ({
      x: offsetX + col * STEP + CELL / 2,
      y: offsetY + row * STEP + CELL / 2,
    })
    const inside = (col: number, row: number) => col >= 0 && col < cols && row >= 0 && row < rows

    /** 대체로 가던 방향으로 가다가 가끔 꺾어요. 뒤로 돌거나 화면 밖으로 나가지는 않아요. */
    function pickNext(worm: Worm) {
      const head = worm.body[0]
      const options = DIRECTIONS.filter(
        (direction) =>
          !(direction.col === -worm.direction.col && direction.row === -worm.direction.row) &&
          inside(head.col + direction.col, head.row + direction.row),
      )
      const straight = options.find(
        (direction) => direction.col === worm.direction.col && direction.row === worm.direction.row,
      )
      const direction =
        straight && Math.random() < 0.72 ? straight : options[Math.floor(Math.random() * options.length)] ?? worm.direction
      worm.direction = direction
      worm.next = { col: head.col + direction.col, row: head.row + direction.row }
    }

    function layout() {
      const ratio = window.devicePixelRatio || 1
      width = canvas!.clientWidth
      height = canvas!.clientHeight
      canvas!.width = width * ratio
      canvas!.height = height * ratio
      context!.setTransform(ratio, 0, 0, ratio, 0, 0)

      cols = Math.floor(width / STEP)
      rows = Math.floor(height / STEP)
      offsetX = (width - cols * STEP + GAP) / 2
      offsetY = (height - rows * STEP + GAP) / 2

      cells = new Map()
      for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
          // 대부분의 칸은 비어 있고, 일부만 서로 다른 세기와 속도로 반짝여요.
          const active = Math.random() < 0.3
          cells.set(key(col, row), {
            x: offsetX + col * STEP,
            y: offsetY + row * STEP,
            level: active ? 0.25 + Math.random() * 0.75 : 0,
            phase: Math.random() * Math.PI * 2,
            speed: 0.25 + Math.random() * 0.55,
            eatenUntil: 0,
          })
        }
      }

      // 화면이 넓을수록 지렁이가 조금 더 많아요.
      const count = cols < 4 || rows < 4 ? 0 : Math.min(4, Math.max(2, Math.round((width * height) / 380000)))
      worms = Array.from({ length: count }, () => {
        const col = Math.floor(Math.random() * cols)
        const row = Math.floor(Math.random() * rows)
        const worm: Worm = {
          body: Array.from({ length: WORM_LENGTH }, () => ({ col, row })),
          direction: DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)],
          next: { col, row },
          progress: Math.random(),
        }
        pickNext(worm)
        return worm
      })
    }

    function advance(worm: Worm, delta: number, now: number) {
      worm.progress += delta / WORM_STEP_MS
      while (worm.progress >= 1) {
        worm.progress -= 1
        worm.body.unshift(worm.next)
        worm.body.pop()
        const eaten = cells.get(key(worm.next.col, worm.next.row))
        if (eaten) eaten.eatenUntil = now + 9000 + Math.random() * 6000
        pickNext(worm)
      }
    }

    function drawWorm(worm: Worm) {
      const head = centerOf(worm.body[0].col, worm.body[0].row)
      const next = centerOf(worm.next.col, worm.next.row)
      const tip = { x: head.x + (next.x - head.x) * worm.progress, y: head.y + (next.y - head.y) * worm.progress }

      // 꼬리 끝은 한 칸 앞으로 당겨지는 중이라, 머리가 나아간 만큼 줄여서 그려요.
      const points = [tip, ...worm.body.map((part) => centerOf(part.col, part.row))]
      const tail = points[points.length - 1]
      const beforeTail = points[points.length - 2]
      points[points.length - 1] = {
        x: tail.x + (beforeTail.x - tail.x) * worm.progress,
        y: tail.y + (beforeTail.y - tail.y) * worm.progress,
      }

      context!.lineCap = 'round'
      context!.lineJoin = 'round'
      context!.lineWidth = CELL - 2
      context!.strokeStyle = `rgba(${BRAND}, 0.7)`
      context!.beginPath()
      points.forEach((point, index) => (index === 0 ? context!.moveTo(point.x, point.y) : context!.lineTo(point.x, point.y)))
      context!.stroke()

      // 머리에 작은 눈 두 개를 그려요.
      const forward = worm.direction
      const side = { x: -forward.row, y: forward.col }
      context!.fillStyle = '#fff'
      for (const sign of [-1, 1]) {
        context!.beginPath()
        context!.arc(tip.x + forward.col * 1.5 + side.x * 2.6 * sign, tip.y + forward.row * 1.5 + side.y * 2.6 * sign, 1.5, 0, Math.PI * 2)
        context!.fill()
      }
    }

    function draw(time: number) {
      const delta = last ? Math.min(100, time - last) : 0
      last = time
      context!.clearRect(0, 0, width, height)

      const seconds = time / 1000
      for (const cell of cells.values()) {
        const lit = cell.level > 0 && time >= cell.eatenUntil
        const glow = lit ? cell.level * (0.5 + 0.5 * Math.sin(seconds * cell.speed + cell.phase)) : 0
        context!.fillStyle = glow > 0.02 ? `rgba(${BRAND}, ${0.05 + glow * 0.3})` : 'rgba(16, 24, 40, 0.035)'
        context!.beginPath()
        context!.roundRect(cell.x, cell.y, CELL, CELL, 3)
        context!.fill()
      }

      for (const worm of worms) {
        if (!still) advance(worm, delta, time)
        drawWorm(worm)
      }

      if (!still) frame = requestAnimationFrame(draw)
    }

    layout()
    frame = requestAnimationFrame(draw)
    const onResize = () => {
      layout()
      if (still) draw(0)
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full [mask-image:radial-gradient(ellipse_110%_46%_at_50%_46%,rgba(0,0,0,0.3)_40%,black_100%)] sm:[mask-image:radial-gradient(ellipse_62%_56%_at_50%_46%,rgba(0,0,0,0.3)_38%,black_100%)]"
    />
  )
}
