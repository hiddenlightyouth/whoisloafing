import { Fragment } from 'react'

/** 별표 두 개로 감싼 부분만 굵게 보여주고, 짝이 맞지 않는 별표는 지워요. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/gs)
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <strong key={index} className="font-bold text-gray-950">
            {part}
          </strong>
        ) : (
          <Fragment key={index}>{part.replaceAll('**', '')}</Fragment>
        ),
      )}
    </>
  )
}
