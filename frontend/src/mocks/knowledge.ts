import type {
  CategoryItem,
  ImportBatch,
  ImportTask,
  KnowledgeUnit,
  Paginated,
  PermissionPayload,
  UnitCreatePayload,
  UnitPermission,
  UnitQuery,
  UnitUpdatePayload,
  UnitVersion,
} from '@/types/knowledge'
import { departmentName, roleName, userName } from '@/mocks/org'

interface PermissionSeed {
  type: UnitPermission['target_type']
  id?: number | null
}

interface UnitSeed {
  id: number
  title: string
  category: string
  fileType: string
  fileName: string
  fileSize: number
  status: 'active' | 'disabled'
  creatorId: number
  tags: string
  version: number
  chunkCount: number
  permissions: PermissionSeed[]
  content: string
}

const seeds: UnitSeed[] = [
  {
    id: 1,
    title: '员工手册（2026 版）',
    category: '人力资源',
    fileType: 'md',
    fileName: '员工手册.md',
    fileSize: 14800,
    status: 'active',
    creatorId: 2,
    tags: '制度,入职,假期',
    version: 3,
    chunkCount: 18,
    permissions: [{ type: 'global' }],
    content:
      '# 员工手册（2026 版）\n\n## 入职与试用期\n新员工入职当日完成劳动合同签署、工牌办理与账号开通。试用期一般为 3 至 6 个月，试用期薪酬为转正后的 80%。转正申请应在试用期结束前 10 个工作日由本人发起，直属主管与人力资源部共同评估。\n\n## 考勤与假期\n标准工作时间为 9:00 至 18:00，午休 12:00 至 13:30。年假：满 1 年 5 天，满 3 年 10 天，满 5 年 15 天，可顺延至次年 3 月 31 日。病假需提供二级以上医院证明；婚假 10 天，陪产假 15 天。\n\n## 行为准则\n遵守公司规章制度，维护公司声誉；对外发布涉及公司的信息须经品牌部门审核。',
  },
  {
    id: 2,
    title: '费用报销管理规范',
    category: '财务制度',
    fileType: 'md',
    fileName: '费用报销管理规范.md',
    fileSize: 12600,
    status: 'active',
    creatorId: 2,
    tags: '报销,发票,财务',
    version: 2,
    chunkCount: 14,
    permissions: [{ type: 'global' }],
    content:
      '# 费用报销管理规范\n\n## 报销流程\n1. 费用发生后取得合法有效发票，抬头为公司全称；\n2. 在 OA 填写报销单并上传发票；\n3. 直属主管审批，单笔超过 5000 元需部门负责人二次审批；\n4. 财务复核后，每周三、周五统一打款。\n\n## 时限与发票\n费用应在发生之日起 30 天内提交；电子发票需上传 PDF 原件并确保未重复报销；定额发票、手写收据不作为凭证。',
  },
  {
    id: 3,
    title: '差旅与出差管理标准',
    category: '财务制度',
    fileType: 'md',
    fileName: '差旅与出差管理标准.md',
    fileSize: 11200,
    status: 'active',
    creatorId: 2,
    tags: '差旅,住宿,补贴',
    version: 1,
    chunkCount: 12,
    permissions: [{ type: 'global' }],
    content:
      '# 差旅与出差管理标准\n\n## 住宿标准\n一线城市每晚不超过 500 元，二线城市 400 元，其他城市 300 元。超标部分由个人承担，特殊情况需提前报备。\n\n## 交通与补贴\n高铁二等座、飞机经济舱；总监及以上可乘高铁一等座。国内出差伙食补贴 100 元 / 天，不再报销餐费。\n\n## 报销材料\n出差结束后 10 个工作日内提交审批单、交通票据、住宿发票与行程单。',
  },
  {
    id: 4,
    title: '研发代码规范与发布流程',
    category: '技术规范',
    fileType: 'pdf',
    fileName: '研发代码规范与发布流程.pdf',
    fileSize: 2_100_000,
    status: 'active',
    creatorId: 3,
    tags: '研发,代码,发布',
    version: 3,
    chunkCount: 18,
    permissions: [{ type: 'department', id: 2 }],
    content:
      '# 研发代码规范与发布流程\n\n## 分支与评审\n主干为 main，开发分支 develop，功能分支 feature/xxx，线上问题 hotfix/xxx。所有合并请求至少 1 名同模块工程师评审，核心模块 2 名。\n\n## 发布流程\n提测 → 灰度观察 30 分钟 → 分批全量，每批间隔 10 分钟 → 发布后观察 2 小时。\n\n## 回滚\n出现 P0 级问题时立即回滚上一稳定版本，值班工程师执行并同步应急群，24 小时内提交复盘报告。',
  },
  {
    id: 5,
    title: '生产环境故障应急手册',
    category: '技术规范',
    fileType: 'pdf',
    fileName: '生产环境故障应急手册.pdf',
    fileSize: 1_600_000,
    status: 'active',
    creatorId: 3,
    tags: '运维,故障,应急',
    version: 2,
    chunkCount: 16,
    permissions: [{ type: 'department', id: 2 }],
    content:
      '# 生产环境故障应急手册\n\n## 故障分级\nP0 核心业务不可用或数据丢失风险；P1 主要功能受损但有绕行；P2 局部异常；P3 体验问题。\n\n## 响应时限\nP0 5 分钟内响应、30 分钟内止损；P1 15 分钟响应、2 小时内恢复。处置顺序为止损 → 定位 → 修复 → 观察。\n\n## 值班制度\n7×24 轮值，值班表每月更新，15 分钟未响应视为脱岗。',
  },
  {
    id: 6,
    title: '信息安全与数据合规红线',
    category: '技术规范',
    fileType: 'pdf',
    fileName: '信息安全与数据合规红线.pdf',
    fileSize: 980_000,
    status: 'active',
    creatorId: 3,
    tags: '安全,合规,数据',
    version: 2,
    chunkCount: 15,
    permissions: [
      { type: 'department', id: 2 },
      { type: 'role', id: 1 },
    ],
    content:
      '# 信息安全与数据合规红线\n\n## 账号安全\n密码不少于 12 位，每 90 天更换；生产系统必须开启多因素认证；禁止共用账号。\n\n## 数据分级\n公开、内部、机密三级；客户个人信息、合同金额、源代码属于机密数据，禁止存入个人设备或未经审批的云盘。\n\n## 违规处理\n违反红线属于严重违纪，视情节解除劳动合同；涉嫌犯罪的移送司法机关。',
  },
  {
    id: 7,
    title: '2026 产品路线图',
    category: '产品管理',
    fileType: 'md',
    fileName: '2026产品路线图.md',
    fileSize: 8600,
    status: 'active',
    creatorId: 5,
    tags: '产品,路线图,规划',
    version: 1,
    chunkCount: 10,
    permissions: [
      { type: 'role', id: 4 },
      { type: 'department', id: 4 },
    ],
    content:
      '# 2026 产品路线图\n\n## 季度重点\nQ1 企业版 3.0 与权限中心；Q2 智能分析模块与开放 API；Q3 行业解决方案与看板 2.0；Q4 Agent 工作流编排与订阅体系。\n\n## 关键指标\n全年 ARR 增长 60%，月活企业客户 5000 家，核心功能使用率 70%，NPS 不低于 45。',
  },
  {
    id: 8,
    title: '市场推广活动执行指南',
    category: '市场运营',
    fileType: 'md',
    fileName: '市场推广活动执行指南.md',
    fileSize: 10400,
    status: 'active',
    creatorId: 4,
    tags: '市场,活动,预算',
    version: 1,
    chunkCount: 11,
    permissions: [{ type: 'department', id: 5 }],
    content:
      '# 市场推广活动执行指南\n\n## 立项与预算\n活动提前 4 周立项，包含目标、人群、形式、预算与预期 ROI。单场超过 10 万元需市场负责人与财务总监共同审批。\n\n## 执行与复盘\n主视觉提前 2 周定稿，物料提前 3 天验收；活动结束后 5 个工作日内提交复盘报告，线索录入 CRM 并分配销售。',
  },
  {
    id: 9,
    title: '客户成功案例集锦',
    category: '市场运营',
    fileType: 'md',
    fileName: '客户成功案例集锦.md',
    fileSize: 9200,
    status: 'active',
    creatorId: 4,
    tags: '客户,案例,销售',
    version: 1,
    chunkCount: 9,
    permissions: [
      { type: 'department', id: 5 },
      { type: 'user', id: 5 },
    ],
    content:
      '# 客户成功案例集锦\n\n## 制造业数字化转型\n某装备制造企业打通供应商协同与生产数据，订单交付周期缩短 25%，库存周转率提升 18%。\n\n## 零售会员运营\n某连锁品牌接入智能分析后，会员复购率提升 12%，活动 ROI 提升 2.3 倍。\n\n## 可复用打法\n先做业务价值验证，再规模化推广；建立联合项目组；以月为单位复盘指标。',
  },
  {
    id: 10,
    title: '高管薪酬与股权激励方案（机密）',
    category: '人力资源',
    fileType: 'docx',
    fileName: '高管薪酬与股权激励方案.docx',
    fileSize: 320_000,
    status: 'disabled',
    creatorId: 2,
    tags: '薪酬,股权,机密',
    version: 1,
    chunkCount: 8,
    permissions: [{ type: 'user', id: 1 }],
    content:
      '# 高管薪酬与股权激励方案（机密）\n\n## 薪酬结构\n基本年薪、绩效年薪与长期激励三部分，绩效年薪占 40%，与年度经营目标完成率挂钩。\n\n## 股权激励\n限制性股票与期权组合，分四年归属，每年 25%；行权价格按授予日公允价值确定。\n\n## 保密要求\n仅限董事、高管与人力资源负责人知悉，禁止复制或外传。',
  },
  {
    id: 11,
    title: 'VPN 与办公网络使用指南',
    category: '技术规范',
    fileType: 'md',
    fileName: 'VPN与办公网络使用指南.md',
    fileSize: 7800,
    status: 'active',
    creatorId: 3,
    tags: 'VPN,网络,IT',
    version: 1,
    chunkCount: 9,
    permissions: [{ type: 'global' }],
    content:
      '# VPN 与办公网络使用指南\n\n## 申请流程\n在 IT 服务台提交「VPN 权限申请」，选择使用场景与期限；直属主管审批后 1 个工作日内开通。外部合作方由对接人代为申请，有效期不超过 30 天。\n\n## 常见问题\n连接失败时检查本地网络与账号状态，切换接入节点；频繁掉线关闭节能模式并更新客户端。\n\n## 安全要求\n仅用于办公用途，禁止共享账号或在不可信环境接入。',
  },
  {
    id: 12,
    title: '绩效管理办法',
    category: '人力资源',
    fileType: 'md',
    fileName: '绩效管理办法.md',
    fileSize: 9600,
    status: 'active',
    creatorId: 2,
    tags: '绩效,考核,OKR',
    version: 1,
    chunkCount: 10,
    permissions: [
      { type: 'department', id: 6 },
      { type: 'role', id: 6 },
    ],
    content:
      '# 绩效管理办法\n\n## 考核周期\n季度考核在季度结束后 10 个工作日内完成；年度考核在次年 1 月完成。\n\n## 目标与评级\n每年初制定 OKR，O 不超过 3 个；评级 S/A/B+/B/C，参考分布 5%/20%/40%/30%/5%。\n\n## 申诉\n结果公布后 5 个工作日内向人力资源部提交书面申诉，10 个工作日内反馈复核结果。',
  },
]

const baseTime = new Date('2026-10-24T10:12:00+08:00').getTime()

function isoAt(hoursAgo: number): string {
  return new Date(baseTime - hoursAgo * 3_600_000).toISOString()
}

function permissionName(type: UnitPermission['target_type'], id: number | null): string {
  if (type === 'global') {
    return '全局公开'
  }
  if (type === 'department') {
    return departmentName(id)
  }
  if (type === 'role') {
    return roleName(id ?? 0)
  }
  return userName(id ?? 0)
}

let permissionSeq = 1

function resolvePermissions(seedsInput: PermissionSeed[]): UnitPermission[] {
  return seedsInput.map((seed) => ({
    id: permissionSeq++,
    target_type: seed.type,
    target_id: seed.id ?? null,
    target_name: permissionName(seed.type, seed.id ?? null),
  }))
}

function summaryOf(content: string): string {
  return content
    .replace(/^#+\s.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150)
}

function toUnit(seed: UnitSeed, hoursAgo: number): KnowledgeUnit {
  const permissions = resolvePermissions(seed.permissions)
  return {
    id: seed.id,
    unit_code: `KU-20261024-${String(seed.id).padStart(4, '0')}`,
    title: seed.title,
    content: seed.content,
    summary: summaryOf(seed.content),
    category: seed.category,
    source_file_name: seed.fileName,
    file_type: seed.fileType,
    file_size: seed.fileSize,
    status: seed.status,
    creator_id: seed.creatorId,
    creator_name: userName(seed.creatorId),
    tags: seed.tags,
    version: seed.version,
    chunk_count: seed.chunkCount,
    index_status: 'synced',
    permissions,
    permission_summary:
      permissions.length === 0
        ? '未配置（无访问权限）'
        : permissions.map((permission) => permission.target_name).join('、'),
    created_at: isoAt(hoursAgo + 48),
    updated_at: isoAt(hoursAgo),
  }
}

const units: KnowledgeUnit[] = seeds.map((seed, index) => toUnit(seed, index * 2 + 1))

const versions = new Map<number, UnitVersion[]>()
for (const unit of units) {
  const current = unit.version
  versions.set(
    unit.id,
    Array.from({ length: current }, (_, index) => {
      const version = current - index
      return {
        version,
        title: unit.title,
        summary: version === current ? unit.summary : `历史版本 v${version}：${unit.summary.slice(0, 80)}`,
        editor_name: index % 2 === 0 ? unit.creator_name : '林晓',
        created_at: isoAt(index * 24 + 2),
        is_current: version === current,
      }
    }),
  )
}

let nextUnitId = 100
let nextPermissionId = 10_000

export function listCategories(): CategoryItem[] {
  const counter = new Map<string, number>()
  for (const unit of units) {
    counter.set(unit.category, (counter.get(unit.category) ?? 0) + 1)
  }
  return [...counter.entries()].map(([name, count]) => ({ name, count }))
}

export function listUnits(query: UnitQuery): Paginated<KnowledgeUnit> {
  const keyword = query.keyword?.trim().toLowerCase()
  const filtered = units
    .filter((unit) => {
      if (keyword && !`${unit.title} ${unit.content}`.toLowerCase().includes(keyword)) {
        return false
      }
      if (query.category && unit.category !== query.category) {
        return false
      }
      if (query.status && unit.status !== query.status) {
        return false
      }
      return true
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))

  const start = (query.page - 1) * query.page_size
  return {
    items: filtered.slice(start, start + query.page_size),
    total: filtered.length,
    page: query.page,
    page_size: query.page_size,
  }
}

export function getUnit(id: number): KnowledgeUnit | undefined {
  return units.find((unit) => unit.id === id)
}

export function updateUnit(id: number, payload: UnitUpdatePayload): KnowledgeUnit | undefined {
  const unit = getUnit(id)
  if (!unit) {
    return undefined
  }
  if (payload.title !== undefined) {
    unit.title = payload.title
  }
  if (payload.content !== undefined) {
    unit.content = payload.content
    unit.summary = summaryOf(payload.content)
  }
  if (payload.category !== undefined) {
    unit.category = payload.category
  }
  if (payload.tags !== undefined) {
    unit.tags = payload.tags
  }
  if (payload.status !== undefined) {
    unit.status = payload.status
  }
  unit.version += 1
  unit.updated_at = new Date().toISOString()
  unit.index_status = 'syncing'
  const list = versions.get(id) ?? []
  for (const version of list) {
    version.is_current = false
  }
  list.unshift({
    version: unit.version,
    title: unit.title,
    summary: unit.summary,
    editor_name: '林晓',
    created_at: new Date().toISOString(),
    is_current: true,
  })
  versions.set(id, list)
  return unit
}

export function createUnit(payload: UnitCreatePayload): KnowledgeUnit {
  const id = nextUnitId++
  const now = new Date().toISOString()
  const permissions = (payload.permissions ?? []).map((permission) => ({
    id: nextPermissionId++,
    target_type: permission.target_type,
    target_id: permission.target_id,
    target_name: permissionName(permission.target_type, permission.target_id),
  }))
  const unit: KnowledgeUnit = {
    id,
    unit_code: `KU-20261024-${String(id).padStart(4, '0')}`,
    title: payload.title,
    content: payload.content,
    summary: summaryOf(payload.content),
    category: payload.category,
    source_file_name: '',
    file_type: 'manual',
    file_size: payload.content.length,
    status: 'active',
    creator_id: 2,
    creator_name: '林晓',
    tags: payload.tags ?? '',
    version: 1,
    chunk_count: Math.max(1, Math.ceil(payload.content.length / 500)),
    index_status: 'synced',
    permissions,
    permission_summary:
      permissions.length === 0
        ? '未配置（无访问权限）'
        : permissions.map((permission) => permission.target_name).join('、'),
    created_at: now,
    updated_at: now,
  }
  units.unshift(unit)
  versions.set(id, [
    {
      version: 1,
      title: unit.title,
      summary: unit.summary,
      editor_name: '林晓',
      created_at: now,
      is_current: true,
    },
  ])
  return unit
}

export function deleteUnits(ids: number[]): number {
  let deleted = 0
  for (const id of ids) {
    const index = units.findIndex((unit) => unit.id === id)
    if (index >= 0) {
      units.splice(index, 1)
      versions.delete(id)
      deleted += 1
    }
  }
  return deleted
}

export function setUnitPermissions(id: number, payloads: PermissionPayload[]): UnitPermission[] {
  const unit = getUnit(id)
  if (!unit) {
    return []
  }
  unit.permissions = payloads.map((payload) => ({
    id: nextPermissionId++,
    target_type: payload.target_type,
    target_id: payload.target_id,
    target_name: permissionName(payload.target_type, payload.target_id),
  }))
  unit.permission_summary =
    unit.permissions.length === 0
      ? '未配置（无访问权限）'
      : unit.permissions.map((permission) => permission.target_name).join('、')
  unit.updated_at = new Date().toISOString()
  return unit.permissions
}

export function listVersions(id: number): UnitVersion[] {
  return versions.get(id) ?? []
}

export function rollbackUnit(id: number, version: number): KnowledgeUnit | undefined {
  const unit = getUnit(id)
  const list = versions.get(id)
  if (!unit || !list) {
    return undefined
  }
  const target = list.find((item) => item.version === version)
  if (!target) {
    return undefined
  }
  unit.version = version
  unit.title = target.title
  unit.summary = target.summary
  unit.updated_at = new Date().toISOString()
  unit.index_status = 'syncing'
  for (const item of list) {
    item.is_current = item.version === version
  }
  return unit
}

export function reindexUnit(id: number): KnowledgeUnit | undefined {
  const unit = getUnit(id)
  if (!unit) {
    return undefined
  }
  unit.index_status = 'synced'
  unit.updated_at = new Date().toISOString()
  return unit
}

interface StoredBatch {
  batch: ImportBatch
  category: string
  startedAt: number
  retried: Set<string>
}

const batches = new Map<string, StoredBatch>()

function statusFor(elapsed: number): { status: ImportTask['status']; progress: number } {
  if (elapsed < 1500) {
    return { status: 'parsing', progress: 15 }
  }
  if (elapsed < 3000) {
    return { status: 'splitting', progress: 40 }
  }
  if (elapsed < 4500) {
    return { status: 'embedding', progress: 70 }
  }
  if (elapsed < 6000) {
    return { status: 'indexing', progress: 88 }
  }
  return { status: 'success', progress: 100 }
}

export function createImportBatch(
  files: Array<{ name: string; size: number }>,
  category: string,
): ImportBatch {
  const id = `batch-${Date.now()}`
  const tasks: ImportTask[] = files.map((file, index) => ({
    id: `task-${Date.now()}-${index}`,
    file_name: file.name,
    file_type: file.name.split('.').pop()?.toLowerCase() ?? 'txt',
    file_size: file.size,
    status: 'pending',
    progress: 0,
  }))
  const batch: ImportBatch = {
    id,
    status: 'processing',
    total: tasks.length,
    success_count: 0,
    failed_count: 0,
    created_at: new Date().toISOString(),
    tasks,
  }
  batches.set(id, { batch, category, startedAt: Date.now(), retried: new Set() })

  // 仅用于演示分类落库；实际导入由 worker 解析文件内容
  for (const task of tasks) {
    task.message = category ? `分类：${category}` : ''
  }
  return batch
}

export function getImportBatch(id: string): ImportBatch | undefined {
  const stored = batches.get(id)
  if (!stored) {
    return undefined
  }
  const elapsed = Date.now() - stored.startedAt
  stored.batch.tasks.forEach((task, index) => {
    if (task.status === 'success') {
      return
    }
    if (stored.retried.has(task.id)) {
      task.status = 'success'
      task.progress = 100
      task.message = '重试成功'
      task.unit_id = task.unit_id ?? 200 + index
      task.unit_code = task.unit_code ?? `KU-20261024-${String(200 + index).padStart(4, '0')}`
      return
    }
    if (index === 3 && elapsed > 6000) {
      task.status = 'failed'
      task.progress = 0
      task.message = 'PDF 文本层为空，需开启 OCR 后重试'
      return
    }
    const next = statusFor(elapsed)
    task.status = next.status
    task.progress = next.progress
    if (next.status === 'success') {
      task.message = '解析入库成功'
      if (!task.unit_id) {
        const title = task.file_name.replace(/\.[^.]+$/, '')
        const unit = createUnit({
          title,
          content: `# ${title}\n\n该知识单元由批量导入生成，默认未配置数据权限。`,
          category: stored.category || '未分类',
        })
        task.unit_id = unit.id
        task.unit_code = unit.unit_code
      }
    }
  })

  stored.batch.success_count = stored.batch.tasks.filter((task) => task.status === 'success').length
  stored.batch.failed_count = stored.batch.tasks.filter((task) => task.status === 'failed').length
  const finished = stored.batch.success_count + stored.batch.failed_count === stored.batch.total
  stored.batch.status = finished
    ? stored.batch.failed_count > 0
      ? 'partial'
      : 'success'
    : 'processing'
  return stored.batch
}

export function retryImportTask(taskId: string): boolean {
  for (const stored of batches.values()) {
    const task = stored.batch.tasks.find((item) => item.id === taskId)
    if (task) {
      stored.retried.add(taskId)
      task.status = 'pending'
      task.progress = 0
      task.message = '已重新排队'
      return true
    }
  }
  return false
}
