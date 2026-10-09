interface Entry<T> {
  value: T
  expiresAt: number
}

/** 만료 시간과 최대 개수가 있는 간단한 메모리 캐시예요. */
export class TtlCache<T> {
  private entries = new Map<string, Entry<T>>()

  constructor(
    private ttlMs: number,
    private maxEntries: number,
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (entry.expiresAt < Date.now()) {
      this.entries.delete(key)
      return undefined
    }
    return entry.value
  }

  set(key: string, value: T): void {
    this.entries.delete(key)
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs })
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value
      if (oldest === undefined) break
      this.entries.delete(oldest)
    }
  }
}
