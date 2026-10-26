import { http } from '@/api/http'
import type { ChatMessage, ChatSession } from '@/types/chat'

export function listSessions(): Promise<ChatSession[]> {
  return http
    .get<{ items: ChatSession[] }>('/api/ai/sessions')
    .then((response) => response.data.items)
}

export function listMessages(sessionId: string): Promise<ChatMessage[]> {
  return http
    .get<{ items: ChatMessage[] }>(`/api/ai/sessions/${sessionId}/messages`)
    .then((response) => response.data.items)
}

export function deleteSession(sessionId: string): Promise<void> {
  return http.delete(`/api/ai/sessions/${sessionId}`).then(() => undefined)
}
