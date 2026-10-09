/**
 * 화면에 노출되는 문구에서 금지된 특수문자(긴 대시, 가운데점, 화살표)와
 * 이모지, 마크다운 기호를 걷어내요. AI 응답과 GitHub에서 온 이름에 모두 적용해요.
 */
export function sanitize(text: string): string {
  return text
    .replace(/\s*[—–―]\s*/g, ', ')
    .replace(/\s*[·・•‧∙]\s*/g, ', ')
    .replace(/\s*(?:[→←↔⇒⇐➡➔➜]|->|=>)\s*/g, ', ')
    .replace(/\p{Extended_Pictographic}|️/gu, '')
    .replace(/\*\*|`/g, '')
    .replace(/,(\s*,)+/g, ',')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}\n(이하 생략)`
}

export function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR')
}
