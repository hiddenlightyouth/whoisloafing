export function TypingDots() {
  return (
    <div className="flex justify-start" role="status" aria-label="입력 중">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-gray-100 px-4 py-4">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="size-1.5 animate-typing rounded-full bg-gray-500"
            style={{ animationDelay: `${index * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}
