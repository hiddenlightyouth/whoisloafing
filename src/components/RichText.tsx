import { Fragment, useEffect, useMemo, useState } from 'react'

interface Segment {
  text: string
  bold: boolean
}

/** 별표 두 개로 감싼 부분만 굵게 보여주고, 짝이 맞지 않는 별표는 지워요. */
function parse(text: string): Segment[] {
  return text
    .split(/\*\*(.+?)\*\*/gs)
    .map((part, index) => ({ text: index % 2 === 1 ? part : part.replaceAll('**', ''), bold: index % 2 === 1 }))
    .filter((segment) => segment.text.length > 0)
}

/** 타자를 치듯 글자가 다 나타나는 데 걸리는 최대 시간 */
const TYPING_MAX_MS = 900
const TYPING_CHAR_MS = 18

interface Props {
  text: string
  /** true면 처음 나타날 때 타자를 치듯 한 글자씩 보여줘요. */
  typed?: boolean
  onDone?: () => void
}

export function RichText({ text, typed = false, onDone }: Props) {
  const segments = useMemo(() => parse(text), [text])
  const total = useMemo(() => segments.reduce((sum, segment) => sum + segment.text.length, 0), [segments])
  const animate = typed && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [shown, setShown] = useState(animate ? 0 : total)

  useEffect(() => {
    if (!animate) {
      onDone?.()
      return
    }
    const duration = Math.min(TYPING_MAX_MS, total * TYPING_CHAR_MS)
    const startedAt = performance.now()
    let frame = requestAnimationFrame(function tick(now) {
      const progress = duration === 0 ? 1 : Math.min(1, (now - startedAt) / duration)
      setShown(Math.ceil(total * progress))
      if (progress < 1) frame = requestAnimationFrame(tick)
      else onDone?.()
    })
    return () => cancelAnimationFrame(frame)
    // 처음 나타날 때 한 번만 재생해요.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  let remaining = shown
  return (
    <>
      {segments.map((segment, index) => {
        const visible = segment.text.slice(0, Math.max(0, remaining))
        remaining -= segment.text.length
        if (!visible) return null
        return segment.bold ? (
          <strong key={index} className="font-bold text-gray-950">
            {visible}
          </strong>
        ) : (
          <Fragment key={index}>{visible}</Fragment>
        )
      })}
    </>
  )
}
