// localStorage는 막혀 있거나(사생활 보호 모드) 가득 차면 오류를 내요.
// 저장하지 못해도 이번 화면은 그대로 동작해야 해서, 읽고 쓰기를 여기서 한 번에 감싸요.

export function readItem(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** null을 넘기면 지워요. */
export function writeItem(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // 저장하지 못해도 이번 화면에서는 그대로 보여요.
  }
}

export function readJson<T>(key: string, fallback: T): T {
  const raw = readItem(key)
  if (raw === null) return fallback
  try {
    return (JSON.parse(raw) as T) ?? fallback
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown) {
  writeItem(key, JSON.stringify(value))
}

/** 켜고 끄는 값. 켜면 '1'을 적고, 끄면 지워요. */
export const readFlag = (key: string) => readItem(key) === '1'

export const writeFlag = (key: string, on: boolean) => writeItem(key, on ? '1' : null)
