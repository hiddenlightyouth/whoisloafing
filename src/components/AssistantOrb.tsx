interface Props {
  expanded: boolean
  onClick: () => void
}

/**
 * 화면 오른쪽 아래에 떠 있는 유리 방울이에요. 넓은 화면에서 질문 메뉴는 이 방울이 말을 거는 것처럼 나와요.
 * 그림 파일 없이 CSS로만 그려요. 모양과 움직임은 `src/index.css`의 orb 규칙에 있어요.
 */
export function AssistantOrb({ expanded, onClick }: Props) {
  return (
    <button
      type="button"
      aria-label={expanded ? '질문 메뉴 접기' : '질문 메뉴 펼치기'}
      aria-expanded={expanded}
      onClick={onClick}
      className="orb"
    >
      <span className="orb-blob orb-blob-a" aria-hidden="true" />
      <span className="orb-blob orb-blob-b" aria-hidden="true" />
      <span className="orb-blob orb-blob-c" aria-hidden="true" />
      <span className="orb-shine" aria-hidden="true" />
    </button>
  )
}
