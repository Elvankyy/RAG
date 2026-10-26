import type {
  OrgDepartment,
  OrgRole,
  OrgUser,
  PermissionCatalogItem,
} from '@/types/org'

export const permissionCatalog: PermissionCatalogItem[] = [
  { code: 'menu:chat', name: 'AI 对话', type: 'menu', module: '工作台' },
  { code: 'menu:profile', name: '个人中心', type: 'menu', module: '工作台' },
  { code: 'menu:dashboard', name: '数据看板', type: 'menu', module: '工作台' },
  { code: 'menu:knowledge', name: '知识维护', type: 'menu', module: '知识维护' },
  { code: 'menu:settlement', name: '知识沉淀', type: 'menu', module: '知识沉淀' },
  { code: 'menu:org', name: '组织架构', type: 'menu', module: '组织权限' },
  { code: 'ai:access', name: 'AI 智能问答', type: 'action', module: 'AI 工作台' },
  { code: 'dashboard:read', name: '查看数据看板', type: 'action', module: '工作台' },
  { code: 'knowledge:read', name: '查看知识单元', type: 'action', module: '知识维护' },
  { code: 'knowledge:import', name: '导入知识文档', type: 'action', module: '知识维护' },
  { code: 'knowledge:create', name: '新增知识单元', type: 'action', module: '知识维护' },
  { code: 'knowledge:update', name: '编辑知识单元', type: 'action', module: '知识维护' },
  { code: 'knowledge:delete', name: '删除知识单元', type: 'action', module: '知识维护' },
  { code: 'knowledge:permission', name: '配置数据权限', type: 'action', module: '知识维护' },
  { code: 'settlement:read', name: '查看知识沉淀', type: 'action', module: '知识沉淀' },
  { code: 'settlement:review', name: '审核 FAQ', type: 'action', module: '知识沉淀' },
  { code: 'settlement:gap-manage', name: '处理知识缺口', type: 'action', module: '知识沉淀' },
  { code: 'user:read', name: '查看用户', type: 'action', module: '组织权限' },
  { code: 'user:create', name: '新增用户', type: 'action', module: '组织权限' },
  { code: 'user:update', name: '编辑用户', type: 'action', module: '组织权限' },
  { code: 'user:delete', name: '删除用户', type: 'action', module: '组织权限' },
  { code: 'user:reset', name: '重置密码', type: 'action', module: '组织权限' },
  { code: 'role:read', name: '查看角色', type: 'action', module: '组织权限' },
  { code: 'role:create', name: '新增角色', type: 'action', module: '组织权限' },
  { code: 'role:update', name: '编辑角色', type: 'action', module: '组织权限' },
  { code: 'role:delete', name: '删除角色', type: 'action', module: '组织权限' },
  { code: 'role:assign', name: '分配角色权限', type: 'action', module: '组织权限' },
  { code: 'dept:read', name: '查看部门', type: 'action', module: '组织权限' },
  { code: 'dept:create', name: '新增部门', type: 'action', module: '组织权限' },
  { code: 'dept:update', name: '编辑部门', type: 'action', module: '组织权限' },
  { code: 'dept:delete', name: '删除部门', type: 'action', module: '组织权限' },
]

const ALL_CODES = permissionCatalog.map((item) => item.code)

export const departments: OrgDepartment[] = [
  { id: 1, parent_id: null, name: '云启科技', leader_id: 1, leader_name: '系统管理员', member_count: 1, sort_order: 0 },
  { id: 2, parent_id: 1, name: '技术部', leader_id: 3, leader_name: '陈思远', member_count: 1, sort_order: 1 },
  { id: 3, parent_id: 2, name: '平台研发组', leader_id: 3, leader_name: '陈思远', member_count: 0, sort_order: 1 },
  { id: 4, parent_id: 1, name: '产品部', leader_id: 5, leader_name: '赵子涵', member_count: 1, sort_order: 2 },
  { id: 5, parent_id: 1, name: '市场部', leader_id: 4, leader_name: '李婉清', member_count: 1, sort_order: 3 },
  { id: 6, parent_id: 1, name: '人力资源部', leader_id: 7, leader_name: '林晓（HR）', member_count: 2, sort_order: 4 },
  { id: 7, parent_id: 1, name: '财务部', leader_id: 6, leader_name: '周建国', member_count: 1, sort_order: 5 },
]

export const roles: OrgRole[] = [
  {
    id: 1,
    role_name: '系统管理员',
    role_code: 'system_admin',
    description: '平台全部菜单与操作权限',
    user_count: 1,
    permission_codes: [...ALL_CODES],
    is_builtin: true,
  },
  {
    id: 2,
    role_name: '知识管理员',
    role_code: 'knowledge_admin',
    description: '维护知识单元、导入文档、审核 FAQ 与知识缺口',
    user_count: 1,
    permission_codes: [
      'menu:chat',
      'menu:profile',
      'menu:dashboard',
      'menu:knowledge',
      'menu:settlement',
      'ai:access',
      'dashboard:read',
      'knowledge:read',
      'knowledge:import',
      'knowledge:create',
      'knowledge:update',
      'knowledge:delete',
      'knowledge:permission',
      'settlement:read',
      'settlement:review',
      'settlement:gap-manage',
      'user:read',
      'role:read',
      'dept:read',
    ],
  },
  {
    id: 3,
    role_name: '普通用户',
    role_code: 'normal_user',
    description: 'AI 问答与授权知识',
    user_count: 4,
    permission_codes: ['menu:chat', 'menu:profile', 'ai:access'],
  },
  {
    id: 4,
    role_name: '产品经理',
    role_code: 'product_manager',
    description: '产品路线图与需求文档',
    user_count: 1,
    permission_codes: ['menu:chat', 'menu:profile', 'ai:access', 'knowledge:read'],
  },
  {
    id: 5,
    role_name: '财务专员',
    role_code: 'finance_staff',
    description: '财务制度与报销规范',
    user_count: 1,
    permission_codes: ['menu:chat', 'menu:profile', 'ai:access', 'knowledge:read'],
  },
  {
    id: 6,
    role_name: 'HRBP',
    role_code: 'hr_partner',
    description: '人力资源业务伙伴',
    user_count: 1,
    permission_codes: ['menu:chat', 'menu:profile', 'ai:access', 'knowledge:read'],
  },
]

export const users: OrgUser[] = [
  { id: 1, username: 'admin', display_name: '系统管理员', department_id: 1, department_name: '云启科技', status: 'active', role_ids: [1], role_names: ['系统管理员'], created_at: '2026-08-12T09:00:00+08:00' },
  { id: 2, username: 'km', display_name: '林晓', department_id: 6, department_name: '人力资源部', status: 'active', role_ids: [2], role_names: ['知识管理员'], created_at: '2026-08-12T09:10:00+08:00' },
  { id: 3, username: 'alice', display_name: '陈思远', department_id: 2, department_name: '技术部', status: 'active', role_ids: [3], role_names: ['普通用户'], created_at: '2026-08-12T09:20:00+08:00' },
  { id: 4, username: 'bob', display_name: '李婉清', department_id: 5, department_name: '市场部', status: 'active', role_ids: [3], role_names: ['普通用户'], created_at: '2026-08-18T10:00:00+08:00' },
  { id: 5, username: 'carol', display_name: '赵子涵', department_id: 4, department_name: '产品部', status: 'active', role_ids: [4, 3], role_names: ['产品经理', '普通用户'], created_at: '2026-09-02T11:00:00+08:00' },
  { id: 6, username: 'david', display_name: '周建国', department_id: 7, department_name: '财务部', status: 'active', role_ids: [5, 3], role_names: ['财务专员', '普通用户'], created_at: '2026-09-02T11:20:00+08:00' },
  { id: 7, username: 'emma', display_name: '林晓（HR）', department_id: 6, department_name: '人力资源部', status: 'active', role_ids: [6, 3], role_names: ['HRBP', '普通用户'], created_at: '2026-09-18T09:30:00+08:00' },
]

let nextUserId = 100
let nextRoleId = 100
let nextDepartmentId = 100

export function departmentName(id: number | null): string {
  return departments.find((department) => department.id === id)?.name ?? '未知部门'
}

export function roleName(id: number): string {
  return roles.find((role) => role.id === id)?.role_name ?? `角色#${id}`
}

export function userName(id: number): string {
  return users.find((user) => user.id === id)?.display_name ?? `用户#${id}`
}

export function refreshCounts(): void {
  for (const department of departments) {
    department.member_count = users.filter((user) => user.department_id === department.id).length
  }
  for (const role of roles) {
    role.user_count = users.filter((user) => user.role_ids.includes(role.id)).length
  }
}

export function listDepartments(): OrgDepartment[] {
  refreshCounts()
  return departments
}

export function createDepartment(payload: {
  name: string
  parent_id?: number | null
  leader_id?: number | null
  sort_order?: number
}): OrgDepartment {
  const department: OrgDepartment = {
    id: nextDepartmentId++,
    parent_id: payload.parent_id ?? null,
    name: payload.name,
    leader_id: payload.leader_id ?? null,
    leader_name: payload.leader_id ? userName(payload.leader_id) : '',
    member_count: 0,
    sort_order: payload.sort_order ?? 0,
  }
  departments.push(department)
  return department
}

export function updateDepartment(
  id: number,
  payload: Partial<Pick<OrgDepartment, 'name' | 'parent_id' | 'leader_id' | 'sort_order'>>,
): OrgDepartment | undefined {
  const department = departments.find((item) => item.id === id)
  if (!department) {
    return undefined
  }
  Object.assign(department, payload)
  department.leader_name = department.leader_id ? userName(department.leader_id) : ''
  return department
}

export function deleteDepartment(id: number): { ok: boolean; message?: string } {
  if (departments.some((item) => item.parent_id === id)) {
    return { ok: false, message: '请先删除子部门' }
  }
  if (users.some((user) => user.department_id === id)) {
    return { ok: false, message: '部门下仍有成员，无法删除' }
  }
  const index = departments.findIndex((item) => item.id === id)
  if (index < 0) {
    return { ok: false, message: '部门不存在' }
  }
  departments.splice(index, 1)
  return { ok: true }
}

export function listUsers(query: {
  keyword?: string
  departmentId?: number
  status?: string
}): OrgUser[] {
  refreshCounts()
  const keyword = query.keyword?.trim().toLowerCase()
  return users.filter((user) => {
    if (keyword && !`${user.username} ${user.display_name}`.toLowerCase().includes(keyword)) {
      return false
    }
    if (query.departmentId && user.department_id !== query.departmentId) {
      return false
    }
    if (query.status && user.status !== query.status) {
      return false
    }
    return true
  })
}

export function createUser(payload: {
  username: string
  display_name: string
  department_id?: number | null
  role_ids?: number[]
  status?: 'active' | 'disabled'
}): { ok: boolean; message?: string; user?: OrgUser } {
  if (users.some((user) => user.username === payload.username)) {
    return { ok: false, message: '用户名已存在' }
  }
  const roleIds = payload.role_ids ?? []
  const user: OrgUser = {
    id: nextUserId++,
    username: payload.username,
    display_name: payload.display_name,
    department_id: payload.department_id ?? null,
    department_name: departmentName(payload.department_id ?? null),
    status: payload.status ?? 'active',
    role_ids: roleIds,
    role_names: roleIds.map((id) => roleName(id)),
    created_at: new Date().toISOString(),
  }
  users.push(user)
  refreshCounts()
  return { ok: true, user }
}

export function updateUser(
  id: number,
  payload: Partial<Pick<OrgUser, 'display_name' | 'department_id' | 'status'>> & {
    role_ids?: number[]
  },
): { ok: boolean; message?: string; user?: OrgUser } {
  const user = users.find((item) => item.id === id)
  if (!user) {
    return { ok: false, message: '用户不存在' }
  }
  if (payload.display_name !== undefined) {
    user.display_name = payload.display_name
  }
  if (payload.department_id !== undefined) {
    user.department_id = payload.department_id
    user.department_name = departmentName(payload.department_id)
  }
  if (payload.status !== undefined) {
    user.status = payload.status
  }
  if (payload.role_ids !== undefined) {
    user.role_ids = payload.role_ids
    user.role_names = payload.role_ids.map((roleId) => roleName(roleId))
  }
  refreshCounts()
  return { ok: true, user }
}

export function setUserStatus(id: number, status: 'active' | 'disabled'): boolean {
  const user = users.find((item) => item.id === id)
  if (!user) {
    return false
  }
  user.status = status
  return true
}

export function deleteUser(id: number): { ok: boolean; message?: string } {
  if (id === 1) {
    return { ok: false, message: '不能删除内置系统管理员' }
  }
  const index = users.findIndex((user) => user.id === id)
  if (index < 0) {
    return { ok: false, message: '用户不存在' }
  }
  users.splice(index, 1)
  refreshCounts()
  return { ok: true }
}

export function listRoles(): OrgRole[] {
  refreshCounts()
  return roles
}

export function createRole(payload: {
  role_name: string
  role_code: string
  description?: string
  permission_codes?: string[]
}): { ok: boolean; message?: string; role?: OrgRole } {
  if (roles.some((role) => role.role_code === payload.role_code)) {
    return { ok: false, message: '角色编码已存在' }
  }
  const role: OrgRole = {
    id: nextRoleId++,
    role_name: payload.role_name,
    role_code: payload.role_code,
    description: payload.description ?? '',
    user_count: 0,
    permission_codes: payload.permission_codes ?? [],
  }
  roles.push(role)
  return { ok: true, role }
}

export function updateRole(
  id: number,
  payload: { role_name?: string; description?: string },
): OrgRole | undefined {
  const role = roles.find((item) => item.id === id)
  if (!role) {
    return undefined
  }
  Object.assign(role, payload)
  return role
}

export function deleteRole(id: number): { ok: boolean; message?: string } {
  const role = roles.find((item) => item.id === id)
  if (!role) {
    return { ok: false, message: '角色不存在' }
  }
  if (role.is_builtin) {
    return { ok: false, message: '内置角色不可删除' }
  }
  if (users.some((user) => user.role_ids.includes(id))) {
    return { ok: false, message: '角色已分配给用户，无法删除' }
  }
  const index = roles.findIndex((item) => item.id === id)
  roles.splice(index, 1)
  return { ok: true }
}

export function setRolePermissions(id: number, codes: string[]): OrgRole | undefined {
  const role = roles.find((item) => item.id === id)
  if (!role) {
    return undefined
  }
  role.permission_codes = [...new Set(codes)]
  return role
}
