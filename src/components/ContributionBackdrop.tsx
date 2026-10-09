import { useEffect, useRef } from 'react'

const CELL = 14
const GAP = 5
const BRAND = '46, 144, 250'

/**
 * 메인 화면 뒤에 깔리는 배경이에요. GitHub 기여도 그래프처럼 생긴 작은 칸들이
 * 아주 옅게, 천천히 켜졌다 꺼져요. 가운데 타이틀과 입력창 주변은 비워 둬요.
 */
export function ContributionBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let cells: { x: number; y: number; level: number; phase: number; speed: number }[] = []
    let width = 0
    let height = 0
    let frame = 0

    function layout() {
      const ratio = window.devicePixelRatio || 1
      width = canvas!.clientWidth
      height = canvas!.clientHeight
      canvas!.width = width * ratio
      canvas!.height = height * ratio
      context!.setTransform(ratio, 0, 0, ratio, 0, 0)

      cells = []
      const step = CELL + GAP
      for (let x = (width % step) / 2; x < width; x += step) {
        for (let y = (height % step) / 2; y < height; y += step) {
          // 대부분의 칸은 비어 있고, 일부만 서로 다른 세기와 속도로 반짝여요.
          const active = Math.random() < 0.3
          cells.push({
            x,
            y,
            level: active ? 0.25 + Math.random() * 0.75 : 0,
            phase: Math.random() * Math.PI * 2,
            speed: 0.25 + Math.random() * 0.55,
          })
        }
      }
    }

    function draw(time: number) {
      context!.clearRect(0, 0, width, height)
      const seconds = time / 1000
      for (const cell of cells) {
        const glow = cell.level > 0 ? cell.level * (0.5 + 0.5 * Math.sin(seconds * cell.speed + cell.phase)) : 0
        context!.fillStyle = glow > 0.02 ? `rgba(${BRAND}, ${0.05 + glow * 0.3})` : 'rgba(16, 24, 40, 0.035)'
        context!.beginPath()
        context!.roundRect(cell.x, cell.y, CELL, CELL, 3)
        context!.fill()
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
      className="pointer-events-none absolute inset-0 size-full [mask-image:radial-gradient(ellipse_110%_48%_at_50%_44%,transparent_45%,black_100%)] sm:[mask-image:radial-gradient(ellipse_62%_58%_at_50%_44%,transparent_42%,black_100%)]"
    />
  )
}
