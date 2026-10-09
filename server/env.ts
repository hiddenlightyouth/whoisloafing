/**
 * 환경 변수를 필요한 순간에 읽어요.
 * Node(Express)에서는 process.env에서, Cloudflare Pages Functions에서는 요청마다 넣어 주는 값에서 읽기 때문에
 * 파일을 불러오는 시점에 값을 고정해 두지 않아요.
 */
const read = (name: string): string | undefined => {
  const value = typeof process !== 'undefined' ? process.env?.[name] : undefined
  return value ? value : undefined
}

export const env = {
  get isProduction() {
    return read('NODE_ENV') === 'production'
  },
  get port() {
    return Number(read('PORT')) || 3001
  },
  get githubToken() {
    return read('GITHUB_TOKEN')
  },
  get geminiApiKey() {
    return read('GEMINI_API_KEY')
  },
  get geminiModel() {
    return read('GEMINI_MODEL') ?? 'gemini-3.8-flash'
  },
  get supabaseUrl() {
    return read('SUPABASE_URL')
  },
  get supabaseServiceRoleKey() {
    return read('SUPABASE_SERVICE_ROLE_KEY')
  },
}

/** Cloudflare가 요청마다 건네주는 환경 변수와 시크릿을 process.env로 옮겨요. */
export function applyBindings(bindings: Record<string, unknown>): void {
  if (typeof process === 'undefined' || !process.env) return
  for (const [name, value] of Object.entries(bindings)) {
    if (typeof value === 'string') process.env[name] = value
  }
}
