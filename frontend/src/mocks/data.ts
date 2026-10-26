import type { DepartmentInfo, RoleInfo } from '@/types/api'

export interface MockUser {
  id: number
  username: string
  password: string
  display_name: string
  status: 'active' | 'disabled'
  department: DepartmentInfo
  roles: RoleInfo[]
  permissionCodes: string[]
}

const MENU_PERMISSIONS = [
  'menu:chat',
  'menu:profile',
  'menu:dashboard',
  'menu:knowledge',
  'menu:settlement',
  'menu:org',
]

const ACTION_PERMISSIONS = [
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
  'user:create',
  'user:update',
  'user:delete',
  'user:reset',
  'role:read',
  'role:create',
  'role:update',
  'role:delete',
  'role:assign',
  'dept:read',
  'dept:create',
  'dept:update',
  'dept:delete',
]

const ALL_PERMISSIONS = [...MENU_PERMISSIONS, ...ACTION_PERMISSIONS]

const KNOWLEDGE_ADMIN_PERMISSIONS = [
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
]

const NORMAL_USER_PERMISSIONS = ['menu:chat', 'menu:profile', 'ai:access']

export const mockUsers: MockUser[] = [
  {
    id: 1,
    username: 'admin',
    password: 'Admin@123',
    display_name: '系统管理员',
    status: 'active',
    department: { id: 1, name: '云启科技' },
    roles: [{ id: 1, role_name: '系统管理员', role_code: 'system_admin' }],
    permissionCodes: ALL_PERMISSIONS,
  },
  {
    id: 2,
    username: 'km',
    password: 'Km@12345',
    display_name: '林晓',
    status: 'active',
    department: { id: 5, name: '人力资源部' },
    roles: [{ id: 2, role_name: '知识管理员', role_code: 'knowledge_admin' }],
    permissionCodes: KNOWLEDGE_ADMIN_PERMISSIONS,
  },
  {
    id: 3,
    username: 'alice',
    password: 'User@123',
    display_name: '陈思远',
    status: 'active',
    department: { id: 2, name: '技术部' },
    roles: [{ id: 3, role_name: '普通用户', role_code: 'normal_user' }],
    permissionCodes: NORMAL_USER_PERMISSIONS,
  },
]

export const mockPasswords = new Map(mockUsers.map((user) => [user.username, user.password]))

export const TOKEN_PREFIX = 'mock-token.'

export function findUserByUsername(username: string): MockUser | undefined {
  return mockUsers.find((user) => user.username === username)
}

export function findUserByToken(token: string | null): MockUser | undefined {
  if (!token?.startsWith(TOKEN_PREFIX)) {
    return undefined
  }
  const username = token.slice(TOKEN_PREFIX.length)
  return findUserByUsername(username)
}

export function toUserInfo(user: MockUser) {
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    status: user.status,
    department: user.department,
    roles: user.roles,
    permissions: user.permissionCodes,
  }
}
