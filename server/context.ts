import { AsyncLocalStorage } from 'node:async_hooks'

/** 요청 하나가 처리되는 동안 어디서든 꺼내 쓸 수 있는 정보예요. AI 호출 기록에 채팅 ID를 남기는 데 써요. */
export const requestContext = new AsyncLocalStorage<{ chatId?: string }>()
