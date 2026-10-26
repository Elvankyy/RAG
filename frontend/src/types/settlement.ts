export type FaqStatus = 'pending_review' | 'published' | 'rejected' | 'offline'
export type FaqSourceType = 'manual' | 'auto_mined'
export type GapStatus = 'unresolved' | 'resolved' | 'ignored'

export interface Faq {
  id: number
  question: string
  answer: string
  category: string
  related_unit_id: number | null
  related_unit_title: string | null
  source_type: FaqSourceType
  status: FaqStatus
  hit_count: number
  recommend_count: number
  cache_status: 'pending' | 'synced' | 'failed'
  reviewed_at: string | null
  created_at: string
}

export interface KnowledgeGap {
  id: number
  question_pattern: string
  sample_questions: string[]
  ask_count: number
  last_asked_at: string
  status: GapStatus
  resolved_unit_id: number | null
  resolved_unit_title: string | null
  created_at: string
}

export interface SettlementSummary {
  pending_faqs: number
  published_faqs: number
  unresolved_gaps: number
  faq_hits: number
}

export interface FaqCreatePayload {
  question: string
  answer: string
  category: string
  related_unit_id: number | null
}

export interface ReviewPayload {
  action: 'approve' | 'reject'
  edited_answer?: string
}
