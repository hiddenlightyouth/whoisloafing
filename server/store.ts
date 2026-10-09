import { createHash } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { StoredMessage } from '../shared/types.ts'
import { requestContext } from './context.ts'
import { env } from './env.ts'

// service role 키는 서버에서만 써요. 브라우저는 Supabase에 직접 붙지 않아요.
// 값이 바뀌지 않는 한 클라이언트를 한 번만 만들어서 다시 써요.
let cached: { key: string; client: SupabaseClient } | null = null

function getClient(): SupabaseClient | null {
  const url = env.supabaseUrl
  const serviceRoleKey = env.supabaseServiceRoleKey
  if (!url || !serviceRoleKey) return null
  const key = `${url}:${serviceRoleKey}`
  if (cached?.key !== key) {
    cached = { key, client: createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }) }
  }
  return cached.client
}

/** Supabase가 설정되어 있을 때만 채팅 저장과 공유, AI 사용량 기록이 켜져요. */
export const storageEnabled = () => getClient() !== null

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_PATTERN.test(value)

/** 브라우저가 보낸 소유자 키는 그대로 저장하지 않고 해시로만 비교해요. */
export const hashOwnerKey = (key: string) => createHash('sha256').update(key).digest('hex')

export interface StoredChat {
  id: string
  repoUrl: string
  ownerKeyHash: string
  sharedAt: string | null
  messages: StoredMessage[]
}

export async function getChat(id: string): Promise<StoredChat | null> {
  const client = getClient()
  if (!client) return null
  const { data, error } = await client
    .from('chats')
    .select('id, repo_url, owner_key_hash, shared_at, messages')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`채팅을 불러오지 못했어요. (${error.message})`)
  if (!data) return null
  return {
    id: data.id,
    repoUrl: data.repo_url,
    ownerKeyHash: data.owner_key_hash,
    sharedAt: data.shared_at,
    messages: Array.isArray(data.messages) ? (data.messages as StoredMessage[]) : [],
  }
}

/** 채팅이 없으면 새로 만들고, 있으면 말풍선을 뒤에 이어 붙여요. */
export async function saveMessages(options: {
  id: string
  repoUrl: string
  ownerKeyHash: string
  existing: StoredChat | null
  added: StoredMessage[]
}): Promise<void> {
  const client = getClient()
  if (!client || options.added.length === 0) return
  const { id, existing, added } = options

  const { error } = existing
    ? await client
        .from('chats')
        .update({ messages: [...existing.messages, ...added], updated_at: new Date().toISOString() })
        .eq('id', id)
        // 그사이에 공유됐다면 더 이상 덧붙이지 않아요.
        .is('shared_at', null)
    : await client.from('chats').insert({
        id,
        repo_url: options.repoUrl,
        owner_key_hash: options.ownerKeyHash,
        messages: added,
      })
  if (error) throw new Error(`채팅을 저장하지 못했어요. (${error.message})`)
}

export async function shareChat(id: string): Promise<void> {
  const client = getClient()
  if (!client) return
  const { error } = await client
    .from('chats')
    .update({ shared_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .is('shared_at', null)
  if (error) throw new Error(`채팅을 공유하지 못했어요. (${error.message})`)
}

export interface AiUsageRecord {
  purpose: 'repo_summary' | 'contributor_profile' | 'narration'
  label?: string
  model: string
  status: 'ok' | 'error'
  error?: string
  systemPrompt: string
  userPrompt: string
  response?: string
  inputTokens?: number
  outputTokens?: number
  thinkingTokens?: number
  totalTokens?: number
  durationMs: number
}

/** AI 호출 한 번을 기록해요. 기록에 실패해도 분석은 멈추지 않게 기다리지 않고 흘려보내요. */
export function logAiUsage(record: AiUsageRecord): void {
  const client = getClient()
  if (!client) return
  const chatId = requestContext.getStore()?.chatId ?? null
  void client
    .from('ai_usage')
    .insert({
      chat_id: chatId,
      purpose: record.purpose,
      label: record.label ?? null,
      model: record.model,
      status: record.status,
      error: record.error ?? null,
      system_prompt: record.systemPrompt,
      user_prompt: record.userPrompt,
      response: record.response ?? null,
      input_tokens: record.inputTokens ?? null,
      output_tokens: record.outputTokens ?? null,
      thinking_tokens: record.thinkingTokens ?? null,
      total_tokens: record.totalTokens ?? null,
      duration_ms: record.durationMs,
    })
    .then(({ error }) => {
      if (error) console.error(`AI 사용량을 기록하지 못했어요. (${error.message})`)
    })
}
