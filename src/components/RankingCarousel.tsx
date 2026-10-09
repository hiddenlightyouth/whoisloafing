import { useRef, useState, type PointerEvent } from 'react'
import type { ContributorStats } from '../../shared/types'
import { track } from '../lib/analytics'
import { StatsCard } from './StatsCard'

/** 참여자별 수치 카드를 말풍선 하나 안에서 좌우로 넘겨 보는 영역이에요. 터치 스와이프와 마우스 드래그를 모두 지원해요. */
export function RankingCarousel({ contributors }: { contributors: ContributorStats[] }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ startX: number; scrollLeft: number; moved: boolean } | null>(null)
  const [active, setActive] = useState(0)
  const [dragging, setDragging] = useState(false)

  const single = contributors.length === 1

  function cardOffset(index: number): number {
    const track = trackRef.current
    const card = track?.children[index] as HTMLElement | undefined
    return track && card ? card.offsetLeft - track.offsetLeft : 0
  }

  function nearestIndex(): number {
    const track = trackRef.current
    if (!track) return 0
    let best = 0
    for (let index = 1; index < contributors.length; index++) {
      if (Math.abs(cardOffset(index) - track.scrollLeft) < Math.abs(cardOffset(best) - track.scrollLeft)) best = index
    }
    return best
  }

  function goTo(index: number) {
    trackRef.current?.scrollTo({ left: cardOffset(index), behavior: 'smooth' })
  }

  // 터치는 브라우저 기본 스크롤에 맡기고, 마우스일 때만 직접 끌어서 넘겨요.
  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !trackRef.current) return
    drag.current = { startX: event.clientX, scrollLeft: trackRef.current.scrollLeft, moved: false }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current
    if (!state || !trackRef.current) return
    const delta = event.clientX - state.startX
    if (!state.moved && Math.abs(delta) < 4) return
    if (!state.moved) {
      state.moved = true
      setDragging(true)
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    trackRef.current.scrollLeft = state.scrollLeft - delta
  }

  function handlePointerEnd() {
    const state = drag.current
    drag.current = null
    if (!state?.moved) return
    setDragging(false)
    goTo(nearestIndex())
  }

  return (
    <div className="mt-3">
      <div
        ref={trackRef}
        onScroll={() => {
          const index = nearestIndex()
          if (index !== active) track('ranking_card_view', { rank: index + 1, total: contributors.length })
          setActive(index)
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        // 끌어서 넘긴 직후에는 카드 안의 링크가 눌리지 않게 해요.
        onClickCapture={(event) => {
          if (dragging) event.preventDefault()
        }}
        className={`flex gap-2.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          dragging ? 'cursor-grabbing select-none' : 'snap-x snap-mandatory'
        } ${single ? '' : 'cursor-grab'}`}
      >
        {contributors.map((contributor, index) => (
          <div
            key={`${contributor.login ?? ''}:${contributor.name}`}
            className={`shrink-0 snap-start ${single ? 'w-full' : 'w-[86%] sm:w-[19rem]'}`}
          >
            <StatsCard contributor={contributor} rank={index + 1} />
          </div>
        ))}
      </div>

      {!single && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {contributors.map((contributor, index) => (
            <button
              key={`${contributor.login ?? ''}:${contributor.name}`}
              type="button"
              aria-label={`${index + 1}위 ${contributor.name} 보기`}
              aria-current={index === active}
              onClick={() => goTo(index)}
              className={`size-1.5 rounded-full transition-colors ${index === active ? 'bg-brand' : 'bg-gray-300'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
