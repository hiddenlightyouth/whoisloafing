import { useEffect, useState } from 'react'

/** 기다리는 동안 번갈아 보여주는 문구예요. */
const PHRASES = [
  '커밋 기록 뒤적이는 중',
  '누가 농땡이 쳤는지 살피는 중',
  '새벽 커밋 세어 보는 중',
  'diff 한 줄씩 음미하는 중',
  '변수 이름 감상하는 중',
  'git blame 꾹 참는 중',
  '주석 속 한숨 읽는 중',
  '머지 충돌의 흔적 찾는 중',
  '코드 줄 수 저울질하는 중',
  '커밋 메시지 해독하는 중',
  'TODO 몇 개 남았나 세는 중',
  '기여도 공정하게 채점하는 중',
]

/** 이 시간보다 오래 기다릴 때만 문구를 보여줘요. 말풍선 사이의 짧은 틈에는 점만 보여요. */
const PHRASE_DELAY_MS = 1000
const PHRASE_INTERVAL_MS = 2400

export function TypingDots() {
  const [index, setIndex] = useState<number | null>(null)

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined
    const delay = setTimeout(() => {
      setIndex(Math.floor(Math.random() * PHRASES.length))
      interval = setInterval(() => setIndex((current) => ((current ?? 0) + 1) % PHRASES.length), PHRASE_INTERVAL_MS)
    }, PHRASE_DELAY_MS)
    return () => {
      clearTimeout(delay)
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="flex justify-start" role="status" aria-label="분석하는 중">
      <div className="flex items-center gap-2.5 rounded-2xl rounded-bl-md bg-gray-100 px-4 py-3.5">
        <span className="flex items-center gap-1">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="size-1.5 animate-typing rounded-full bg-gray-500"
              style={{ animationDelay: `${dot * 0.15}s` }}
            />
          ))}
        </span>
        {index !== null && (
          <span key={index} className="animate-rise">
            <span className="animate-shimmer bg-[linear-gradient(90deg,#98a2b3_0%,#98a2b3_40%,#1d2939_50%,#98a2b3_60%,#98a2b3_100%)] bg-[length:200%_100%] bg-clip-text text-[14px] text-transparent">
              {PHRASES[index]}
            </span>
          </span>
        )}
      </div>
    </div>
  )
}
