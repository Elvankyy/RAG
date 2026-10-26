import { HttpResponse, delay, http } from 'msw'

import {
  TOKEN_PREFIX,
  findUserByToken,
  findUserByUsername,
  mockPasswords,
  toUserInfo,
} from '@/mocks/data'
import {
  createChatStream,
  getSessionMessages,
  listSessionSummaries,
  removeSession,
} from '@/mocks/chat'
import {
  createImportBatch,
  createUnit,
  deleteUnits,
  getImportBatch,
  getUnit,
  listCategories,
  listUnits,
  listVersions,
  reindexUnit,
  retryImportTask,
  rollbackUnit,
  setUnitPermissions,
  updateUnit,
} from '@/mocks/knowledge'
import {
  createFaq,
  createUnitFromGap,
  deleteFaq,
  getSummary,
  ignoreGap,
  listFaqs,
  listGaps,
  listRecommendations,
  offlineFaq,
  resolveGap,
  reviewFaq,
} from '@/mocks/settlement'
import {
  getMetrics,
  getQuestionRanking,
  getTokenStats,
  getUnitRanking,
} from '@/mocks/dashboard'
import {
  createDepartment,
  createRole,
  createUser,
  deleteDepartment,
  deleteRole,
  deleteUser,
  listDepartments,
  listRoles,
  listUsers,
  permissionCatalog,
  setRolePermissions,
  setUserStatus,
  updateDepartment,
  updateRole,
  updateUser,
} from '@/mocks/org'

interface LoginBody {
  username?: string
  password?: string
}

interface PasswordBody {
  old_password?: string
  new_password?: string
}

function unauthorized(message = '用户名或密码错误') {
  return HttpResponse.json(
    { code: 'INVALID_CREDENTIALS', message },
    { status: 401 },
  )
}

function readToken(request: Request): string | null {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) {
    return null
  }
  return header.slice('Bearer '.length)
}

export const handlers = [
  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as LoginBody
    await delay(320)

    const user = findUserByUsername((body.username ?? '').trim())
    if (!user || user.password !== body.password) {
      return unauthorized()
    }
    if (user.status !== 'active') {
      return HttpResponse.json(
        { code: 'ACCOUNT_DISABLED', message: '账号已被禁用，请联系管理员' },
        { status: 403 },
      )
    }

    return HttpResponse.json({
      access_token: `${TOKEN_PREFIX}${user.username}`,
      refresh_token: `mock-refresh.${user.username}`,
      token_type: 'bearer',
      user_info: toUserInfo(user),
      permissions: user.permissionCodes,
    })
  }),

  http.get('/api/auth/me', async ({ request }) => {
    await delay(160)
    const user = findUserByToken(readToken(request))
    if (!user) {
      return HttpResponse.json(
        { code: 'UNAUTHORIZED', message: '登录状态已过期' },
        { status: 401 },
      )
    }
    return HttpResponse.json(toUserInfo(user))
  }),

  http.post('/api/auth/logout', async () => {
    await delay(120)
    return new HttpResponse(null, { status: 204 })
  }),

  http.put('/api/auth/password', async ({ request }) => {
    const body = (await request.json()) as PasswordBody
    await delay(200)
    const user = findUserByToken(readToken(request))
    if (!user) {
      return HttpResponse.json(
        { code: 'UNAUTHORIZED', message: '登录状态已过期' },
        { status: 401 },
      )
    }
    if (mockPasswords.get(user.username) !== body.old_password) {
      return HttpResponse.json(
        { code: 'INVALID_PASSWORD', message: '原密码不正确' },
        { status: 400 },
      )
    }
    if (!body.new_password || body.new_password.length < 8) {
      return HttpResponse.json(
        { code: 'WEAK_PASSWORD', message: '新密码至少 8 位' },
        { status: 400 },
      )
    }
    mockPasswords.set(user.username, body.new_password)
    user.password = body.new_password
    return HttpResponse.json({ message: '密码修改成功' })
  }),

  http.get('/api/ai/sessions', async ({ request }) => {
    await delay(120)
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    return HttpResponse.json({ items: listSessionSummaries() })
  }),

  http.get('/api/ai/sessions/:id/messages', async ({ request, params }) => {
    await delay(140)
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    return HttpResponse.json({ items: getSessionMessages(String(params.id)) })
  }),

  http.delete('/api/ai/sessions/:id', async ({ request, params }) => {
    await delay(100)
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    removeSession(String(params.id))
    return new HttpResponse(null, { status: 204 })
  }),

  http.post('/api/ai/chat/stream', async ({ request }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    const body = (await request.json()) as { question?: string; session_id?: string | null }
    const question = (body.question ?? '').trim()
    if (!question) {
      return HttpResponse.json({ code: 'INVALID_QUESTION', message: '问题不能为空' }, { status: 400 })
    }
    await delay(120)
    return new HttpResponse(createChatStream(question, body.session_id ?? null), {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  }),

  http.get('/api/knowledge/categories', async ({ request }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(80)
    return HttpResponse.json({ items: listCategories() })
  }),

  http.get('/api/knowledge/units', async ({ request }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(140)
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') ?? '1') || 1
    const pageSize = Number(url.searchParams.get('page_size') ?? '10') || 10
    return HttpResponse.json(
      listUnits({
        keyword: url.searchParams.get('keyword') || undefined,
        category: url.searchParams.get('category') || undefined,
        status: url.searchParams.get('status') || undefined,
        page,
        page_size: pageSize,
      }),
    )
  }),

  http.post('/api/knowledge/units', async ({ request }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(180)
    const body = (await request.json()) as {
      title?: string
      content?: string
      category?: string
      tags?: string
    }
    if (!body.title?.trim() || !body.content?.trim()) {
      return HttpResponse.json({ code: 'INVALID_UNIT', message: '标题与正文不能为空' }, { status: 400 })
    }
    return HttpResponse.json(
      createUnit({
        title: body.title.trim(),
        content: body.content,
        category: body.category || '未分类',
        tags: body.tags,
      }),
      { status: 201 },
    )
  }),

  http.get('/api/knowledge/units/:id', async ({ request, params }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(120)
    const unit = getUnit(Number(params.id))
    if (!unit) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: '知识单元不存在' }, { status: 404 })
    }
    return HttpResponse.json(unit)
  }),

  http.put('/api/knowledge/units/:id', async ({ request, params }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(220)
    const body = (await request.json()) as Record<string, string>
    const unit = updateUnit(Number(params.id), {
      title: body.title,
      content: body.content,
      category: body.category,
      tags: body.tags,
      status: body.status as 'active' | 'disabled' | undefined,
    })
    if (!unit) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: '知识单元不存在' }, { status: 404 })
    }
    return HttpResponse.json(unit)
  }),

  http.delete('/api/knowledge/units', async ({ request }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(160)
    const body = (await request.json()) as { ids?: number[] }
    return HttpResponse.json({ deleted: deleteUnits(body.ids ?? []) })
  }),

  http.get('/api/knowledge/units/:id/permissions', async ({ request, params }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    return HttpResponse.json({ items: getUnit(Number(params.id))?.permissions ?? [] })
  }),

  http.post('/api/knowledge/units/:id/permissions', async ({ request, params }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(200)
    const body = (await request.json()) as {
      permissions?: Array<{
        target_type: 'global' | 'department' | 'role' | 'user'
        target_id: number | null
      }>
    }
    return HttpResponse.json({
      items: setUnitPermissions(Number(params.id), body.permissions ?? []),
    })
  }),

  http.get('/api/knowledge/units/:id/versions', async ({ request, params }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    return HttpResponse.json({ items: listVersions(Number(params.id)) })
  }),

  http.post('/api/knowledge/units/:id/versions/:version/rollback', async ({ request, params }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(200)
    const unit = rollbackUnit(Number(params.id), Number(params.version))
    if (!unit) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: '版本不存在' }, { status: 404 })
    }
    return HttpResponse.json(unit)
  }),

  http.post('/api/knowledge/units/:id/reindex', async ({ request, params }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(320)
    const unit = reindexUnit(Number(params.id))
    if (!unit) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: '知识单元不存在' }, { status: 404 })
    }
    return HttpResponse.json(unit)
  }),

  http.post('/api/knowledge/import', async ({ request }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(300)
    const form = await request.formData()
    const files = form
      .getAll('files')
      .filter((value): value is File => value instanceof File)
      .map((file) => ({ name: file.name, size: file.size }))
    if (files.length === 0) {
      return HttpResponse.json({ code: 'NO_FILES', message: '请至少选择一个文件' }, { status: 400 })
    }
    const batch = createImportBatch(files, String(form.get('category') ?? ''))
    return HttpResponse.json({ ...batch, batch_id: batch.id })
  }),

  http.get('/api/knowledge/import/batches/:id', async ({ request, params }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    const batch = getImportBatch(String(params.id))
    if (!batch) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: '批次不存在' }, { status: 404 })
    }
    return HttpResponse.json(batch)
  }),

  http.post('/api/knowledge/import/tasks/:id/retry', async ({ request, params }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(120)
    if (!retryImportTask(String(params.id))) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: '任务不存在' }, { status: 404 })
    }
    return HttpResponse.json({ message: '已重新排队' })
  }),

  http.get('/api/org/departments', async ({ request }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(80)
    const items = listDepartments()
    return HttpResponse.json({ items, tree: items })
  }),

  http.post('/api/org/departments', async ({ request }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(160)
    const body = (await request.json()) as {
      name?: string
      parent_id?: number | null
      leader_id?: number | null
      sort_order?: number
    }
    if (!body.name?.trim()) {
      return HttpResponse.json({ code: 'INVALID_NAME', message: '部门名称不能为空' }, { status: 400 })
    }
    return HttpResponse.json(
      createDepartment({
        name: body.name.trim(),
        parent_id: body.parent_id ?? null,
        leader_id: body.leader_id ?? null,
        sort_order: body.sort_order ?? 0,
      }),
      { status: 201 },
    )
  }),

  http.put('/api/org/departments/:id', async ({ request, params }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(160)
    const body = (await request.json()) as Record<string, unknown>
    const department = updateDepartment(Number(params.id), body)
    if (!department) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: '部门不存在' }, { status: 404 })
    }
    return HttpResponse.json(department)
  }),

  http.delete('/api/org/departments/:id', async ({ request, params }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(140)
    const result = deleteDepartment(Number(params.id))
    if (!result.ok) {
      return HttpResponse.json({ code: 'DELETE_FAILED', message: result.message }, { status: 400 })
    }
    return HttpResponse.json({ message: '部门已删除' })
  }),

  http.get('/api/org/users', async ({ request }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(100)
    const url = new URL(request.url)
    const items = listUsers({
      keyword: url.searchParams.get('keyword') || undefined,
      departmentId: Number(url.searchParams.get('department_id')) || undefined,
      status: url.searchParams.get('status') || undefined,
    })
    return HttpResponse.json({ items, total: items.length })
  }),

  http.post('/api/org/users', async ({ request }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(180)
    const body = (await request.json()) as {
      username?: string
      password?: string
      display_name?: string
      department_id?: number | null
      role_ids?: number[]
      status?: 'active' | 'disabled'
    }
    if (!body.username?.trim() || !body.display_name?.trim() || !body.password) {
      return HttpResponse.json({ code: 'INVALID_USER', message: '用户名、显示名与密码不能为空' }, { status: 400 })
    }
    const result = createUser({
      username: body.username.trim(),
      display_name: body.display_name.trim(),
      department_id: body.department_id ?? null,
      role_ids: body.role_ids ?? [],
      status: body.status ?? 'active',
    })
    if (!result.ok) {
      return HttpResponse.json({ code: 'DUPLICATE', message: result.message }, { status: 400 })
    }
    return HttpResponse.json(result.user, { status: 201 })
  }),

  http.put('/api/org/users/:id', async ({ request, params }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(180)
    const body = (await request.json()) as {
      display_name?: string
      department_id?: number | null
      role_ids?: number[]
      status?: 'active' | 'disabled'
    }
    const result = updateUser(Number(params.id), body)
    if (!result.ok) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: result.message }, { status: 404 })
    }
    return HttpResponse.json(result.user)
  }),

  http.post('/api/org/users/:id/reset-password', async ({ request, params }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(160)
    const body = (await request.json()) as { new_password?: string }
    if (!body.new_password || body.new_password.length < 6) {
      return HttpResponse.json({ code: 'WEAK_PASSWORD', message: '密码至少 6 位' }, { status: 400 })
    }
    return HttpResponse.json({ message: `用户 ${params.id} 密码已重置` })
  }),

  http.post('/api/org/users/:id/status', async ({ request, params }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(140)
    const body = (await request.json()) as { status?: 'active' | 'disabled' }
    if (!body.status || !setUserStatus(Number(params.id), body.status)) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: '用户不存在' }, { status: 404 })
    }
    return HttpResponse.json({ message: '状态已更新' })
  }),

  http.delete('/api/org/users/:id', async ({ request, params }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(160)
    const result = deleteUser(Number(params.id))
    if (!result.ok) {
      return HttpResponse.json({ code: 'DELETE_FAILED', message: result.message }, { status: 400 })
    }
    return HttpResponse.json({ message: '用户已删除' })
  }),

  http.get('/api/org/roles', async ({ request }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(80)
    return HttpResponse.json({ items: listRoles() })
  }),

  http.get('/api/org/permissions', async ({ request }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    return HttpResponse.json({ items: permissionCatalog })
  }),

  http.post('/api/org/roles', async ({ request }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(160)
    const body = (await request.json()) as {
      role_name?: string
      role_code?: string
      description?: string
      permission_codes?: string[]
    }
    if (!body.role_name?.trim() || !body.role_code?.trim()) {
      return HttpResponse.json({ code: 'INVALID_ROLE', message: '角色名称与编码不能为空' }, { status: 400 })
    }
    const result = createRole({
      role_name: body.role_name.trim(),
      role_code: body.role_code.trim(),
      description: body.description ?? '',
      permission_codes: body.permission_codes ?? [],
    })
    if (!result.ok) {
      return HttpResponse.json({ code: 'DUPLICATE', message: result.message }, { status: 400 })
    }
    return HttpResponse.json(result.role, { status: 201 })
  }),

  http.put('/api/org/roles/:id', async ({ request, params }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(160)
    const body = (await request.json()) as { role_name?: string; description?: string }
    const role = updateRole(Number(params.id), body)
    if (!role) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: '角色不存在' }, { status: 404 })
    }
    return HttpResponse.json(role)
  }),

  http.delete('/api/org/roles/:id', async ({ request, params }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(140)
    const result = deleteRole(Number(params.id))
    if (!result.ok) {
      return HttpResponse.json({ code: 'DELETE_FAILED', message: result.message }, { status: 400 })
    }
    return HttpResponse.json({ message: '角色已删除' })
  }),

  http.post('/api/org/roles/:id/permissions', async ({ request, params }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(200)
    const body = (await request.json()) as { permission_codes?: string[] }
    const role = setRolePermissions(Number(params.id), body.permission_codes ?? [])
    if (!role) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: '角色不存在' }, { status: 404 })
    }
    return HttpResponse.json(role)
  }),

  http.get('/api/dashboard/metrics', async ({ request }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(140)
    return HttpResponse.json(getMetrics())
  }),

  http.get('/api/dashboard/rankings/questions', async ({ request }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(120)
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit') ?? '5') || 5
    return HttpResponse.json({ items: getQuestionRanking(limit) })
  }),

  http.get('/api/dashboard/rankings/units', async ({ request }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(120)
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit') ?? '5') || 5
    return HttpResponse.json({ items: getUnitRanking(limit) })
  }),

  http.get('/api/dashboard/stats/tokens', async ({ request }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(140)
    const url = new URL(request.url)
    const days = Number(url.searchParams.get('days') ?? '14') || 14
    return HttpResponse.json(getTokenStats(days))
  }),

  http.get('/api/settlement/summary', async ({ request }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(80)
    return HttpResponse.json(getSummary())
  }),

  http.get('/api/settlement/faqs/recommendations', async ({ request }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(140)
    return HttpResponse.json(listRecommendations())
  }),

  http.get('/api/settlement/faqs', async ({ request }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(100)
    const url = new URL(request.url)
    return HttpResponse.json({ items: listFaqs(url.searchParams.get('status') || undefined) })
  }),

  http.post('/api/settlement/faqs', async ({ request }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(160)
    const body = (await request.json()) as {
      question?: string
      answer?: string
      category?: string
      related_unit_id?: number | null
    }
    if (!body.question?.trim() || !body.answer?.trim()) {
      return HttpResponse.json({ code: 'INVALID_FAQ', message: '问题与答案不能为空' }, { status: 400 })
    }
    return HttpResponse.json(
      createFaq({
        question: body.question.trim(),
        answer: body.answer.trim(),
        category: body.category || '通用',
        related_unit_id: body.related_unit_id ?? null,
      }),
      { status: 201 },
    )
  }),

  http.post('/api/settlement/faqs/:id/review', async ({ request, params }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(200)
    const body = (await request.json()) as { action?: 'approve' | 'reject'; edited_answer?: string }
    if (body.action !== 'approve' && body.action !== 'reject') {
      return HttpResponse.json({ code: 'INVALID_ACTION', message: '审核动作不合法' }, { status: 400 })
    }
    const result = reviewFaq(Number(params.id), {
      action: body.action,
      edited_answer: body.edited_answer,
    })
    if (!result.ok) {
      return HttpResponse.json({ code: 'REVIEW_FAILED', message: result.message }, { status: 400 })
    }
    return HttpResponse.json(result.faq)
  }),

  http.post('/api/settlement/faqs/:id/offline', async ({ request, params }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(160)
    const result = offlineFaq(Number(params.id))
    if (!result.ok) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: result.message }, { status: 404 })
    }
    return HttpResponse.json({ message: 'FAQ 已下线，缓存已失效' })
  }),

  http.delete('/api/settlement/faqs/:id', async ({ request, params }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(140)
    if (!deleteFaq(Number(params.id))) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'FAQ 不存在' }, { status: 404 })
    }
    return HttpResponse.json({ message: 'FAQ 已删除' })
  }),

  http.get('/api/settlement/knowledge-gaps', async ({ request }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(120)
    const url = new URL(request.url)
    const items = listGaps(url.searchParams.get('status') || undefined)
    return HttpResponse.json({ items, total: items.length })
  }),

  http.post('/api/settlement/knowledge-gaps/:id/resolve', async ({ request, params }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(140)
    const body = (await request.json()) as { unit_id?: number | null }
    const result = resolveGap(Number(params.id), body.unit_id ?? null)
    if (!result.ok) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: result.message }, { status: 404 })
    }
    return HttpResponse.json({ message: '知识缺口已标记为已解决' })
  }),

  http.post('/api/settlement/knowledge-gaps/:id/ignore', async ({ request, params }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(120)
    const result = ignoreGap(Number(params.id))
    if (!result.ok) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: result.message }, { status: 404 })
    }
    return HttpResponse.json({ message: '已忽略该知识缺口' })
  }),

  http.post('/api/settlement/knowledge-gaps/:id/create-unit', async ({ request, params }) => {
    if (!findUserByToken(readToken(request))) {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: '登录状态已过期' }, { status: 401 })
    }
    await delay(220)
    const body = (await request.json()) as { title?: string; category?: string; content?: string }
    const result = createUnitFromGap(Number(params.id), body)
    if (!result.ok) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: result.message }, { status: 404 })
    }
    return HttpResponse.json({
      unit_id: result.unit_id,
      unit_code: result.unit_code,
      message: '已创建知识单元，请继续完善内容并配置数据权限',
    }, { status: 201 })
  }),
]
