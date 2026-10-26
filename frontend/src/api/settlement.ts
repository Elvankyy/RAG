import { http } from '@/api/http'
import type {
  Faq,
  FaqCreatePayload,
  KnowledgeGap,
  ReviewPayload,
  SettlementSummary,
} from '@/types/settlement'

export function getSummary(): Promise<SettlementSummary> {
  return http
    .get<SettlementSummary>('/api/settlement/summary')
    .then((response) => response.data)
}

export function getRecommendations(): Promise<{
  items: Faq[]
  newly_mined: number
  total: number
}> {
  return http
    .get<{ items: Faq[]; newly_mined: number; total: number }>(
      '/api/settlement/faqs/recommendations',
    )
    .then((response) => response.data)
}

export function listFaqs(status?: string): Promise<Faq[]> {
  return http
    .get<{ items: Faq[] }>('/api/settlement/faqs', { params: { status } })
    .then((response) => response.data.items)
}

export function reviewFaq(id: number, payload: ReviewPayload): Promise<Faq> {
  return http
    .post<Faq>(`/api/settlement/faqs/${id}/review`, payload)
    .then((response) => response.data)
}

export function offlineFaq(id: number): Promise<void> {
  return http.post(`/api/settlement/faqs/${id}/offline`).then(() => undefined)
}

export function createFaq(payload: FaqCreatePayload): Promise<Faq> {
  return http.post<Faq>('/api/settlement/faqs', payload).then((response) => response.data)
}

export function deleteFaq(id: number): Promise<void> {
  return http.delete(`/api/settlement/faqs/${id}`).then(() => undefined)
}

export function listGaps(status?: string): Promise<KnowledgeGap[]> {
  return http
    .get<{ items: KnowledgeGap[] }>('/api/settlement/knowledge-gaps', { params: { status } })
    .then((response) => response.data.items)
}

export function resolveGap(id: number, unitId?: number | null): Promise<void> {
  return http
    .post(`/api/settlement/knowledge-gaps/${id}/resolve`, { unit_id: unitId ?? null })
    .then(() => undefined)
}

export function ignoreGap(id: number): Promise<void> {
  return http.post(`/api/settlement/knowledge-gaps/${id}/ignore`).then(() => undefined)
}

export function createUnitFromGap(
  id: number,
  payload: { title?: string; category?: string; content?: string },
): Promise<{ unit_id: number; unit_code: string; message: string }> {
  return http
    .post<{ unit_id: number; unit_code: string; message: string }>(
      `/api/settlement/knowledge-gaps/${id}/create-unit`,
      payload,
    )
    .then((response) => response.data)
}
