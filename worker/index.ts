import { applyBindings } from '../server/env.ts'
import { getConfig, readChat, readOwnerKey, shareChatById, SSE_HEADERS, streamAnalysis, type JsonResult } from '../server/handlers.ts'

/**
 * Cloudflare Workers에 배포했을 때 /api 아래의 모든 요청을 받는 진입점이에요.
 * 정적 파일은 wrangler.toml의 assets 설정으로 Cloudflare가 바로 서빙하고, /api 요청만 여기로 와요.
 * 실제 동작은 Express와 똑같이 server/handlers.ts에 있고, 여기서는 요청과 응답만 이어 줘요.
 * 환경 변수와 시크릿은 Cloudflare 대시보드의 Worker 설정에서 넣어요.
 */
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
}

const json = (result: JsonResult, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  })

async function handleApi(request: Request, env: Record<string, unknown>, ctx: ExecutionContext): Promise<Response> {
  // 대시보드에서 넣은 값을 서버 코드가 읽을 수 있게 옮겨요.
  applyBindings(env)

  const path = new URL(request.url).pathname.replace(/\/+$/, '')
  const ownerKey = readOwnerKey(request.headers.get('x-owner-key'))

  if (request.method === 'GET' && path === '/api/config') return json(getConfig())

  const chat = /^\/api\/chats\/([^/]+)(\/share)?$/.exec(path)
  if (chat && !chat[2] && request.method === 'GET') {
    return json(await readChat(chat[1], ownerKey), { 'Cache-Control': 'no-store' })
  }
  if (chat && chat[2] && request.method === 'POST') return json(await shareChatById(chat[1], ownerKey))

  if (request.method === 'POST' && path === '/api/analyze') {
    const body: unknown = await request.json().catch(() => ({}))
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
    const writer = writable.getWriter()
    const encoder = new TextEncoder()

    let closed = false
    request.signal.addEventListener('abort', () => {
      closed = true
    })

    const work = streamAnalysis({
      body,
      ownerKey,
      ip: request.headers.get('cf-connecting-ip') ?? 'unknown',
      write: (chunk) => {
        if (closed) return
        writer.write(encoder.encode(chunk)).catch(() => {
          closed = true
        })
      },
      isClosed: () => closed,
    }).finally(() => writer.close().catch(() => {}))

    // 사용자가 연결을 끊어도 채팅 저장까지 마칠 수 있게 해요.
    ctx.waitUntil(work)
    return new Response(readable, { headers: SSE_HEADERS })
  }

  return json({ status: 404, body: { error: 'not_found' } })
}

export default { fetch: handleApi }
