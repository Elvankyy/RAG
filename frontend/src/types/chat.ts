export interface ChatSession {
  id: string
  title: string
  last_message: string
  updated_at: string
  created_at: string
}

export interface Citation {
  index: number
  unit_id: number
  unit_code: string
  title: string
  category: string
  score: number
  snippet: string
}

export interface TokenUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  token_source?: string
}

export type ChatRole = 'user' | 'assistant'

export type ChatMessageStatus = 'streaming' | 'done' | 'stopped' | 'error'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  citations: Citation[]
  unauthorizedCount: number
  usage?: TokenUsage
  faqHit?: boolean
  status?: ChatMessageStatus
  error?: string
  createdAt?: string
}

export interface ChatStreamMeta {
  session_id: string
  faq_hit: boolean
  citations: Citation[]
  unauthorized_count: number
  recalled_count: number
  authorized_count: number
}

export interface ChatStreamDone {
  log_id?: number
  session_id: string
  response_time_ms: number
  first_token_ms?: number
  total_tokens: number
  prompt_tokens?: number
  completion_tokens?: number
  token_source?: string
  citations: Citation[]
  unauthorized_count: number
  faq_hit: boolean
  permission_notice?: string
}

export interface ChatStreamHandlers {
  onMeta: (meta: ChatStreamMeta) => void
  onDelta: (content: string) => void
  onUsage: (usage: TokenUsage) => void
  onDone: (done: ChatStreamDone) => void
  onError: (message: string) => void
}

export interface ChatRequest {
  question: string
  session_id?: string | null
}
