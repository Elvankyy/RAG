import { http } from '@/api/http'
import type {
  DashboardMetrics,
  QuestionRankItem,
  TokenStatsResponse,
  UnitRankItem,
} from '@/types/dashboard'

export function getMetrics(): Promise<DashboardMetrics> {
  return http
    .get<DashboardMetrics>('/api/dashboard/metrics')
    .then((response) => response.data)
}

export function getQuestionRanking(limit = 5): Promise<QuestionRankItem[]> {
  return http
    .get<{ items: QuestionRankItem[] }>('/api/dashboard/rankings/questions', { params: { limit } })
    .then((response) => response.data.items)
}

export function getUnitRanking(limit = 5): Promise<UnitRankItem[]> {
  return http
    .get<{ items: UnitRankItem[] }>('/api/dashboard/rankings/units', { params: { limit } })
    .then((response) => response.data.items)
}

export function getTokenStats(days = 14): Promise<TokenStatsResponse> {
  return http
    .get<TokenStatsResponse>('/api/dashboard/stats/tokens', { params: { days } })
    .then((response) => response.data)
}
