import type { ChatMessage, ChatSession, Citation } from '@/types/chat'

interface StoredSession {
  session: ChatSession
  messages: ChatMessage[]
}

const sessionStore = new Map<string, StoredSession>()

function citation(
  index: number,
  unitId: number,
  unitCode: string,
  title: string,
  category: string,
  score: number,
  snippet: string,
): Citation {
  return { index, unit_id: unitId, unit_code: unitCode, title, category, score, snippet }
}

function nowIso(offsetMinutes = 0): string {
  return new Date(Date.now() - offsetMinutes * 60_000).toISOString()
}

function assistantMessage(
  content: string,
  citations: Citation[],
  unauthorizedCount = 0,
  faqHit = false,
): ChatMessage {
  return {
    id: `a-seed-${Math.random().toString(16).slice(2, 10)}`,
    role: 'assistant',
    content,
    citations,
    unauthorizedCount,
    faqHit,
    status: 'done',
    usage: { prompt_tokens: 320, completion_tokens: 180, total_tokens: 500, token_source: 'estimate' },
  }
}

function seedSession(
  id: string,
  title: string,
  minutesAgo: number,
  messages: ChatMessage[],
): void {
  sessionStore.set(id, {
    session: {
      id,
      title,
      last_message: messages[messages.length - 1]?.content.slice(0, 60) ?? '',
      updated_at: nowIso(minutesAgo),
      created_at: nowIso(minutesAgo + 30),
    },
    messages,
  })
}

seedSession('sess-vpn', 'VPN 权限与办公网络', 26, [
  {
    id: 'u-seed-1',
    role: 'user',
    content: '如何申请 VPN 权限？外部合作方可以申请吗？',
    citations: [],
    unauthorizedCount: 0,
    status: 'done',
  },
  assistantMessage(
    '可在 IT 服务台提交「VPN 权限申请」：\n\n1. 选择使用场景与预计使用期限；\n2. 直属主管审批后，IT 在 1 个工作日内开通并发送配置邮件；\n3. 外部合作方由对接人代为申请，权限有效期不超过 **30 天**。\n\n连接失败时先检查本地网络与账号状态，再尝试切换接入节点。',
    [
      citation(1, 11, 'KU-20261024-0011', 'VPN 与办公网络使用指南', '技术规范', 0.93, '登录 IT 服务台提交 VPN 权限申请，直属主管审批后 1 个工作日内开通。'),
      citation(2, 6, 'KU-20261024-0006', '信息安全与数据合规红线', '技术规范', 0.81, 'VPN 仅用于办公用途，禁止在不可信环境接入。'),
    ],
    2,
  ),
])

seedSession('sess-travel', '差旅住宿标准是多少', 180, [
  {
    id: 'u-seed-2',
    role: 'user',
    content: '出差住宿标准是多少？',
    citations: [],
    unauthorizedCount: 0,
    status: 'done',
  },
  assistantMessage(
    '住宿标准按城市分级：\n\n- 一线城市（北京、上海、广州、深圳）：每晚不超过 **500 元**；\n- 二线城市：每晚不超过 **400 元**；\n- 其他城市：每晚不超过 **300 元**。\n\n超标部分由个人承担，特殊情况需提前报备。',
    [
      citation(1, 3, 'KU-20261024-0003', '差旅与出差管理标准', '财务制度', 0.91, '一线城市每晚不超过 500 元，二线城市 400 元，其他城市 300 元。'),
    ],
  ),
])

seedSession('sess-reimburse', '报销流程与发票要求', 420, [
  {
    id: 'u-seed-3',
    role: 'user',
    content: '报销流程是什么？电子发票可以报销吗？',
    citations: [],
    unauthorizedCount: 0,
    status: 'done',
  },
  assistantMessage(
    '报销需在费用发生 **30 天**内在 OA 提交：填写报销单并上传发票 → 直属主管审批 → 财务复核 → 每周三、周五统一打款。\n\n电子发票可以报销，但需上传 PDF 原件并确保未重复报销；单笔超过 5000 元需部门负责人二次审批。',
    [
      citation(1, 2, 'KU-20261024-0002', '费用报销管理规范', '财务制度', 0.95, '费用发生 30 天内提交报销，电子发票需上传 PDF 原件并确保未重复。'),
    ],
    0,
    true,
  ),
])

seedSession('sess-release', '研发发布回滚流程', 1440, [
  {
    id: 'u-seed-4',
    role: 'user',
    content: '发布后发现问题如何回滚？',
    citations: [],
    unauthorizedCount: 0,
    status: 'done',
  },
  assistantMessage(
    '出现 P0 级问题时立即回滚上一稳定版本：\n\n1. 值班工程师执行回滚；\n2. 同步至应急群；\n3. 回滚后 24 小时内提交复盘报告。\n\n灰度阶段发现异常时，先停止放量再定位。',
    [
      citation(1, 4, 'KU-20261024-0004', '研发代码规范与发布流程', '技术规范', 0.88, '出现 P0 级问题时立即回滚上一稳定版本。'),
    ],
    1,
  ),
])

export function listSessionSummaries(): ChatSession[] {
  return [...sessionStore.values()]
    .map((item) => item.session)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

export function getSessionMessages(sessionId: string): ChatMessage[] {
  return sessionStore.get(sessionId)?.messages ?? []
}

export function removeSession(sessionId: string): void {
  sessionStore.delete(sessionId)
}

function createSession(question: string): ChatSession {
  const session: ChatSession = {
    id: `sess-${Date.now()}`,
    title: question.slice(0, 30) || '新的对话',
    last_message: question.slice(0, 60),
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  }
  sessionStore.set(session.id, { session, messages: [] })
  return session
}

interface MockReply {
  answer: string
  citations: Citation[]
  unauthorizedCount: number
  faqHit: boolean
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

function buildReply(question: string): MockReply {
  const normalized = question.replace(/\s+/g, '')

  if (normalized.includes('报销流程') || normalized.includes('发票')) {
    return {
      answer:
        '报销需在费用发生 **30 天**内在 OA 提交：填写报销单并上传发票 → 直属主管审批 → 财务复核 → 每周三、周五统一打款。\n\n电子发票需上传 PDF 原件，确保未重复报销；单笔超过 5000 元需部门负责人二次审批。',
      citations: [
        citation(1, 2, 'KU-20261024-0002', '费用报销管理规范', '财务制度', 0.96, '费用发生 30 天内提交报销，电子发票需上传 PDF 原件。'),
      ],
      unauthorizedCount: 0,
      faqHit: true,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    }
  }

  if (normalized.includes('年假') || normalized.includes('假期')) {
    return {
      answer:
        '入职满 1 年享有 **5 天**年假，满 3 年 **10 天**，满 5 年 **15 天**；年假可跨年度顺延至次年 3 月 31 日。\n\n病假需提供二级以上医院证明；婚假 10 天，陪产假 15 天。',
      citations: [
        citation(1, 1, 'KU-20261024-0001', '员工手册（2026 版）', '人力资源', 0.94, '年假标准：满 1 年 5 天，满 3 年 10 天，满 5 年 15 天。'),
      ],
      unauthorizedCount: 0,
      faqHit: true,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    }
  }

  if (normalized.includes('VPN') || normalized.includes('vpn')) {
    return {
      answer:
        '可在 IT 服务台提交「VPN 权限申请」：\n\n1. 选择使用场景与预计使用期限；\n2. 直属主管审批后，IT 在 1 个工作日内开通并发送配置邮件；\n3. 外部合作方由对接人代为申请，有效期不超过 **30 天**。\n\n连接失败时先检查本地网络与账号状态，再尝试切换接入节点。',
      citations: [
        citation(1, 11, 'KU-20261024-0011', 'VPN 与办公网络使用指南', '技术规范', 0.93, '登录 IT 服务台提交 VPN 权限申请，1 个工作日内开通。'),
        citation(2, 6, 'KU-20261024-0006', '信息安全与数据合规红线', '技术规范', 0.81, 'VPN 仅用于办公用途，禁止在不可信环境接入。'),
      ],
      unauthorizedCount: 2,
      faqHit: false,
      usage: { prompt_tokens: 640, completion_tokens: 220, total_tokens: 860 },
    }
  }

  if (normalized.includes('海外') || normalized.includes('签证')) {
    return {
      answer:
        '知识库中暂未找到关于海外差旅签证的可用依据。\n\n建议：\n- 联系行政或人力资源确认签证办理流程；\n- 该问题已记录为知识缺口，管理员补充知识后可再次查询。',
      citations: [],
      unauthorizedCount: 0,
      faqHit: false,
      usage: { prompt_tokens: 260, completion_tokens: 120, total_tokens: 380 },
    }
  }

  return {
    answer:
      '根据知识库检索结果，为你整理如下：\n\n- **试用期**：一般为 3 至 6 个月，薪酬为转正后的 80%；转正申请需在试用期结束前 10 个工作日发起。\n- **考勤**：标准工作时间 9:00–18:00，弹性打卡最晚不超过 10:00。\n- **行为准则**：对外发布涉及公司的信息须经品牌部门审核。\n\n如需更具体的制度条款，可以继续追问。',
    citations: [
      citation(1, 1, 'KU-20261024-0001', '员工手册（2026 版）', '人力资源', 0.87, '试用期一般为 3 至 6 个月，薪酬为转正后的 80%。'),
      citation(2, 6, 'KU-20261024-0006', '信息安全与数据合规红线', '技术规范', 0.74, '对外发布涉及公司的信息须经品牌部门审核。'),
    ],
    unauthorizedCount: 1,
    faqHit: false,
    usage: { prompt_tokens: 520, completion_tokens: 260, total_tokens: 780 },
  }
}

function sse(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

function chunkText(text: string, size = 14): string[] {
  const chunks: string[] = []
  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size))
  }
  return chunks
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function createChatStream(question: string, sessionId: string | null): ReadableStream<Uint8Array> {
  const session = sessionId && sessionStore.has(sessionId) ? sessionStore.get(sessionId)! : { session: createSession(question), messages: [] }
  const stored = sessionStore.get(session.session.id)!
  const startedAt = Date.now()
  const reply = buildReply(question)
  const userMessage: ChatMessage = {
    id: `u-${Date.now()}`,
    role: 'user',
    content: question,
    citations: [],
    unauthorizedCount: 0,
    status: 'done',
  }

  stored.messages.push(userMessage)
  stored.session.last_message = question.slice(0, 60)
  stored.session.updated_at = new Date().toISOString()

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      await wait(180)
      controller.enqueue(
        sse('meta', {
          session_id: stored.session.id,
          faq_hit: reply.faqHit,
          citations: reply.citations,
          unauthorized_count: reply.unauthorizedCount,
          recalled_count: reply.citations.length + reply.unauthorizedCount,
          authorized_count: reply.citations.length,
        }),
      )

      for (const piece of chunkText(reply.answer)) {
        await wait(18)
        controller.enqueue(sse('delta', { content: piece }))
      }

      await wait(60)
      controller.enqueue(
        sse('usage', {
          prompt_tokens: reply.usage.prompt_tokens,
          completion_tokens: reply.usage.completion_tokens,
          total_tokens: reply.usage.total_tokens,
          token_source: 'estimate',
        }),
      )

      const done = {
        log_id: Date.now(),
        session_id: stored.session.id,
        response_time_ms: Date.now() - startedAt,
        first_token_ms: 180,
        total_tokens: reply.usage.total_tokens,
        prompt_tokens: reply.usage.prompt_tokens,
        completion_tokens: reply.usage.completion_tokens,
        token_source: 'estimate',
        citations: reply.citations,
        unauthorized_count: reply.unauthorizedCount,
        faq_hit: reply.faqHit,
        permission_notice:
          reply.unauthorizedCount > 0
            ? `另有 ${reply.unauthorizedCount} 个相关知识单元因权限限制未展示，请联系知识管理员申请访问。`
            : '',
      }
      controller.enqueue(sse('done', done))

      stored.messages.push({
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: reply.answer,
        citations: reply.citations,
        unauthorizedCount: reply.unauthorizedCount,
        faqHit: reply.faqHit,
        usage: { ...reply.usage, token_source: 'estimate' },
        status: 'done',
      })
      controller.close()
    },
  })
}
