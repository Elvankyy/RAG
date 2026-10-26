export interface DashboardMetrics {
  visits: number
  uv: number
  unit_count: number
  total_tokens: number
  avg_response_ms: number
  today_visits: number
  today_uv: number
  week_tokens: number
  visits_growth: number
  tokens_growth: number
}

export interface QuestionRankItem {
  question: string
  count: number
  last_asked_at: string | null
}

export interface UnitRankItem {
  unit_id: number
  unit_code: string
  title: string
  category: string
  count: number
}

export interface TokenStatItem {
  date: string
  visits: number
  uv: number
  tokens: number
  avg_response_ms: number
}

export interface ResponseBucket {
  label: string
  count: number
}

export interface TokenStatsResponse {
  items: TokenStatItem[]
  response_distribution: ResponseBucket[]
}
