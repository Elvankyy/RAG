import { listUnits } from '@/mocks/knowledge'
import type {
  DashboardMetrics,
  QuestionRankItem,
  ResponseBucket,
  TokenStatItem,
  TokenStatsResponse,
  UnitRankItem,
} from '@/types/dashboard'

const VISITS = [62, 78, 70, 92, 85, 110, 96, 120, 105, 130, 118, 140, 128, 150]
const TOKENS = [182000, 214000, 198000, 256000, 241000, 310000, 288000, 342000, 305000, 368000, 341000, 402000, 376000, 428000]
const UV = [34, 41, 38, 47, 44, 52, 49, 58, 53, 61, 57, 66, 62, 71]
const RESPONSE = [1280, 1190, 1320, 1150, 1080, 1240, 1010, 980, 1120, 940, 1060, 890, 920, 860]

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function allDays(days: number): TokenStatItem[] {
  const today = new Date()
  return Array.from({ length: days }, (_, index) => {
    const offset = days - 1 - index
    const date = new Date(today)
    date.setDate(today.getDate() - offset)
    const source = (VISITS.length - days + index + VISITS.length) % VISITS.length
    return {
      date: formatDate(date),
      visits: VISITS[source] ?? 100,
      uv: UV[source] ?? 50,
      tokens: TOKENS[source] ?? 300000,
      avg_response_ms: RESPONSE[source] ?? 1000,
    }
  })
}

export function getMetrics(): DashboardMetrics {
  const items = allDays(14)
  const visits = items.reduce((sum, item) => sum + item.visits, 0)
  const totalTokens = items.reduce((sum, item) => sum + item.tokens, 0)
  const uv = 326
  const avgResponse = Math.round(
    items.reduce((sum, item) => sum + item.avg_response_ms, 0) / items.length,
  )
  const today = items[items.length - 1]
  const week = items.slice(-7)
  const previousWeek = items.slice(-14, -7)
  const weekTokens = week.reduce((sum, item) => sum + item.tokens, 0)
  const prevTokens = previousWeek.reduce((sum, item) => sum + item.tokens, 0)
  const weekVisits = week.reduce((sum, item) => sum + item.visits, 0)
  const prevVisits = previousWeek.reduce((sum, item) => sum + item.visits, 0)

  return {
    visits,
    uv,
    unit_count: listUnits({ page: 1, page_size: 100 }).total,
    total_tokens: totalTokens,
    avg_response_ms: avgResponse,
    today_visits: today?.visits ?? 0,
    today_uv: today?.uv ?? 0,
    week_tokens: weekTokens,
    visits_growth: prevVisits ? Math.round(((weekVisits - prevVisits) / prevVisits) * 1000) / 10 : 0,
    tokens_growth: prevTokens ? Math.round(((weekTokens - prevTokens) / prevTokens) * 1000) / 10 : 0,
  }
}

const QUESTION_SEEDS: QuestionRankItem[] = [
  { question: '报销流程是什么？', count: 86, last_asked_at: '2026-10-24T11:20:00+08:00' },
  { question: '如何申请 VPN 权限？', count: 64, last_asked_at: '2026-10-24T10:42:00+08:00' },
  { question: '年假有多少天？', count: 52, last_asked_at: '2026-10-23T17:10:00+08:00' },
  { question: '出差住宿标准是多少？', count: 41, last_asked_at: '2026-10-23T15:32:00+08:00' },
  { question: '研发发布流程有哪些步骤？', count: 35, last_asked_at: '2026-10-22T16:05:00+08:00' },
  { question: '试用期转正流程是什么？', count: 28, last_asked_at: '2026-10-22T09:40:00+08:00' },
  { question: '信息安全红线包括哪些？', count: 21, last_asked_at: '2026-10-21T14:18:00+08:00' },
]

export function getQuestionRanking(limit: number): QuestionRankItem[] {
  return QUESTION_SEEDS.slice(0, limit)
}

export function getUnitRanking(limit: number): UnitRankItem[] {
  const units = listUnits({ page: 1, page_size: 100 }).items.slice(0, limit)
  const counts = [142, 128, 96, 74, 61, 55, 42]
  return units.map((unit, index) => ({
    unit_id: unit.id,
    unit_code: unit.unit_code,
    title: unit.title,
    category: unit.category,
    count: counts[index] ?? 30,
  }))
}

export function getTokenStats(days: number): TokenStatsResponse {
  const items = allDays(days)
  const total = items.reduce((sum, item) => sum + item.visits, 0)
  const buckets = [
    { label: '< 0.5s', ratio: 0.12 },
    { label: '0.5–1s', ratio: 0.38 },
    { label: '1–2s', ratio: 0.31 },
    { label: '2–5s', ratio: 0.15 },
    { label: '> 5s', ratio: 0.04 },
  ]
  const distribution: ResponseBucket[] = buckets.map((bucket) => ({
    label: bucket.label,
    count: Math.round(total * bucket.ratio),
  }))
  return { items, response_distribution: distribution }
}
