import { createUnit, getUnit } from '@/mocks/knowledge'
import type {
  Faq,
  FaqCreatePayload,
  GapStatus,
  KnowledgeGap,
  ReviewPayload,
  SettlementSummary,
} from '@/types/settlement'

const faqs: Faq[] = [
  {
    id: 1,
    question: '试用期转正流程是什么？',
    answer:
      '试用期一般为 3 至 6 个月，试用期薪酬为转正后的 80%。转正申请需在试用期结束前 10 个工作日由本人发起，直属主管与人力资源部共同评估；评估通过后签署转正确认单。',
    category: '人力资源',
    related_unit_id: 1,
    related_unit_title: '员工手册（2026 版）',
    source_type: 'auto_mined',
    status: 'pending_review',
    hit_count: 0,
    recommend_count: 8,
    cache_status: 'pending',
    reviewed_at: null,
    created_at: '2026-10-24T09:00:00+08:00',
  },
  {
    id: 2,
    question: '出差住宿标准是多少？',
    answer:
      '住宿标准按城市分级：一线城市每晚不超过 500 元，二线城市 400 元，其他城市 300 元；超标部分由个人承担，特殊情况需提前报备。',
    category: '财务制度',
    related_unit_id: 3,
    related_unit_title: '差旅与出差管理标准',
    source_type: 'auto_mined',
    status: 'pending_review',
    hit_count: 0,
    recommend_count: 7,
    cache_status: 'pending',
    reviewed_at: null,
    created_at: '2026-10-24T08:30:00+08:00',
  },
  {
    id: 3,
    question: '如何申请会议室？',
    answer: '待管理员补充标准答案。',
    category: '行政管理',
    related_unit_id: null,
    related_unit_title: null,
    source_type: 'auto_mined',
    status: 'pending_review',
    hit_count: 0,
    recommend_count: 6,
    cache_status: 'pending',
    reviewed_at: null,
    created_at: '2026-10-23T17:00:00+08:00',
  },
  {
    id: 4,
    question: '报销流程是什么？',
    answer:
      '报销需在费用发生 30 天内在 OA 提交报销单：填写单据并上传发票 → 直属主管审批 → 财务复核 → 每周三、周五统一打款。单笔超过 5000 元需部门负责人二次审批。',
    category: '财务制度',
    related_unit_id: 2,
    related_unit_title: '费用报销管理规范',
    source_type: 'manual',
    status: 'published',
    hit_count: 24,
    recommend_count: 0,
    cache_status: 'synced',
    reviewed_at: '2026-10-22T10:00:00+08:00',
    created_at: '2026-10-22T09:30:00+08:00',
  },
  {
    id: 5,
    question: '年假有多少天？',
    answer:
      '入职满 1 年享有 5 天年假，满 3 年 10 天，满 5 年 15 天；年假可跨年度顺延至次年 3 月 31 日。',
    category: '人力资源',
    related_unit_id: 1,
    related_unit_title: '员工手册（2026 版）',
    source_type: 'manual',
    status: 'published',
    hit_count: 31,
    recommend_count: 0,
    cache_status: 'synced',
    reviewed_at: '2026-10-20T14:00:00+08:00',
    created_at: '2026-10-20T13:40:00+08:00',
  },
  {
    id: 6,
    question: '如何申请 VPN 权限？',
    answer:
      '登录 IT 服务台提交「VPN 权限申请」，选择使用场景与期限，直属主管审批后 IT 在 1 个工作日内开通并发送配置邮件。外部合作方由对接人代申请，有效期不超过 30 天。',
    category: '技术规范',
    related_unit_id: 11,
    related_unit_title: 'VPN 与办公网络使用指南',
    source_type: 'manual',
    status: 'published',
    hit_count: 18,
    recommend_count: 0,
    cache_status: 'synced',
    reviewed_at: '2026-10-19T11:00:00+08:00',
    created_at: '2026-10-19T10:30:00+08:00',
  },
]

const gaps: KnowledgeGap[] = [
  {
    id: 1,
    question_pattern: '海外差旅签证如何办理？',
    sample_questions: ['海外差旅签证如何办理？', '出国签证需要哪些材料？'],
    ask_count: 5,
    last_asked_at: '2026-10-24T11:20:00+08:00',
    status: 'unresolved',
    resolved_unit_id: null,
    resolved_unit_title: null,
    created_at: '2026-10-21T09:00:00+08:00',
  },
  {
    id: 2,
    question_pattern: '公司支持远程办公吗？',
    sample_questions: ['公司支持远程办公吗？'],
    ask_count: 4,
    last_asked_at: '2026-10-23T16:40:00+08:00',
    status: 'unresolved',
    resolved_unit_id: null,
    resolved_unit_title: null,
    created_at: '2026-10-22T09:00:00+08:00',
  },
  {
    id: 3,
    question_pattern: '如何申请专利奖励？',
    sample_questions: ['如何申请专利奖励？', '专利奖励标准是什么？'],
    ask_count: 3,
    last_asked_at: '2026-10-22T09:15:00+08:00',
    status: 'unresolved',
    resolved_unit_id: null,
    resolved_unit_title: null,
    created_at: '2026-10-20T09:00:00+08:00',
  },
  {
    id: 4,
    question_pattern: '会议室预订系统在哪里？',
    sample_questions: ['会议室预订系统在哪里？'],
    ask_count: 2,
    last_asked_at: '2026-10-21T14:08:00+08:00',
    status: 'unresolved',
    resolved_unit_id: null,
    resolved_unit_title: null,
    created_at: '2026-10-21T09:00:00+08:00',
  },
  {
    id: 5,
    question_pattern: '供应商准入流程是什么？',
    sample_questions: ['供应商准入流程是什么？'],
    ask_count: 2,
    last_asked_at: '2026-10-20T10:32:00+08:00',
    status: 'ignored',
    resolved_unit_id: null,
    resolved_unit_title: null,
    created_at: '2026-10-19T09:00:00+08:00',
  },
]

let nextFaqId = 100

export function getSummary(): SettlementSummary {
  return {
    pending_faqs: faqs.filter((faq) => faq.status === 'pending_review').length,
    published_faqs: faqs.filter((faq) => faq.status === 'published').length,
    unresolved_gaps: gaps.filter((gap) => gap.status === 'unresolved').length,
    faq_hits: faqs.reduce((sum, faq) => sum + faq.hit_count, 0),
  }
}

export function listRecommendations(): { items: Faq[]; newly_mined: number; total: number } {
  const items = faqs
    .filter((faq) => faq.status === 'pending_review')
    .sort((a, b) => b.recommend_count - a.recommend_count)
  return { items, newly_mined: 0, total: items.length }
}

export function listFaqs(status?: string): Faq[] {
  if (!status || status === 'all') {
    return [...faqs].sort((a, b) => b.id - a.id)
  }
  return faqs.filter((faq) => faq.status === status)
}

export function reviewFaq(
  id: number,
  payload: ReviewPayload,
): { ok: boolean; message?: string; faq?: Faq } {
  const faq = faqs.find((item) => item.id === id)
  if (!faq) {
    return { ok: false, message: 'FAQ 不存在' }
  }
  if (faq.status === 'published' && payload.action === 'approve') {
    return { ok: false, message: '该 FAQ 已发布' }
  }
  if (payload.edited_answer?.trim()) {
    faq.answer = payload.edited_answer.trim()
  }
  if (payload.action === 'approve') {
    faq.status = 'published'
    faq.cache_status = 'synced'
    faq.reviewed_at = new Date().toISOString()
  } else {
    faq.status = 'rejected'
    faq.cache_status = 'pending'
    faq.reviewed_at = new Date().toISOString()
  }
  return { ok: true, faq }
}

export function offlineFaq(id: number): { ok: boolean; message?: string } {
  const faq = faqs.find((item) => item.id === id)
  if (!faq) {
    return { ok: false, message: 'FAQ 不存在' }
  }
  faq.status = 'offline'
  faq.cache_status = 'pending'
  return { ok: true }
}

export function createFaq(payload: FaqCreatePayload): Faq {
  const unit = payload.related_unit_id ? getUnit(payload.related_unit_id) : undefined
  const faq: Faq = {
    id: nextFaqId++,
    question: payload.question,
    answer: payload.answer,
    category: payload.category,
    related_unit_id: payload.related_unit_id,
    related_unit_title: unit?.title ?? null,
    source_type: 'manual',
    status: 'published',
    hit_count: 0,
    recommend_count: 0,
    cache_status: 'synced',
    reviewed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  }
  faqs.push(faq)
  return faq
}

export function deleteFaq(id: number): boolean {
  const index = faqs.findIndex((faq) => faq.id === id)
  if (index < 0) {
    return false
  }
  faqs.splice(index, 1)
  return true
}

export function listGaps(status?: string): KnowledgeGap[] {
  const items = !status || status === 'all' ? gaps : gaps.filter((gap) => gap.status === status)
  return [...items].sort((a, b) => b.ask_count - a.ask_count || b.id - a.id)
}

export function resolveGap(id: number, unitId?: number | null): { ok: boolean; message?: string } {
  const gap = gaps.find((item) => item.id === id)
  if (!gap) {
    return { ok: false, message: '知识缺口不存在' }
  }
  gap.status = 'resolved'
  gap.resolved_unit_id = unitId ?? null
  gap.resolved_unit_title = unitId ? (getUnit(unitId)?.title ?? null) : null
  return { ok: true }
}

export function ignoreGap(id: number): { ok: boolean; message?: string } {
  const gap = gaps.find((item) => item.id === id)
  if (!gap) {
    return { ok: false, message: '知识缺口不存在' }
  }
  gap.status = 'ignored'
  return { ok: true }
}

export function createUnitFromGap(
  id: number,
  payload: { title?: string; category?: string; content?: string },
): { ok: boolean; message?: string; unit_id?: number; unit_code?: string } {
  const gap = gaps.find((item) => item.id === id)
  if (!gap) {
    return { ok: false, message: '知识缺口不存在' }
  }
  const title = (payload.title ?? gap.question_pattern).trim()
  const content =
    payload.content?.trim() ||
    `# ${title}\n\n> 该知识单元由知识缺口一键创建，请补充完整答案。\n\n典型提问：\n${gap.sample_questions
      .map((question) => `- ${question}`)
      .join('\n')}`
  const unit = createUnit({
    title,
    content,
    category: payload.category || '未分类',
  })
  gap.status = 'resolved'
  gap.resolved_unit_id = unit.id
  gap.resolved_unit_title = unit.title
  return { ok: true, unit_id: unit.id, unit_code: unit.unit_code }
}

export function gapStats(): {
  unresolved: number
  newThisWeek: number
  resolved: number
  avgAsk: number
} {
  const unresolved = gaps.filter((gap) => gap.status === 'unresolved')
  const resolved = gaps.filter((gap) => gap.status === 'resolved').length
  const avgAsk =
    unresolved.length > 0
      ? unresolved.reduce((sum, gap) => sum + gap.ask_count, 0) / unresolved.length
      : 0
  return {
    unresolved: unresolved.length,
    newThisWeek: unresolved.filter((gap) => gap.ask_count >= 4).length,
    resolved,
    avgAsk: Math.round(avgAsk * 10) / 10,
  }
}

export type { GapStatus }
