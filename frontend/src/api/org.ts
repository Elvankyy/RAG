import { http } from '@/api/http'
import type {
  OrgDepartment,
  OrgRole,
  OrgUser,
  PermissionCatalogItem,
} from '@/types/org'

export interface UserQuery {
  keyword?: string
  department_id?: number
  status?: string
}

export function listDepartments(): Promise<OrgDepartment[]> {
  return http
    .get<{ items: OrgDepartment[] }>('/api/org/departments')
    .then((response) => response.data.items)
}

export function createDepartment(payload: {
  name: string
  parent_id?: number | null
  leader_id?: number | null
  sort_order?: number
}): Promise<OrgDepartment> {
  return http
    .post<OrgDepartment>('/api/org/departments', payload)
    .then((response) => response.data)
}

export function updateDepartment(
  id: number,
  payload: Partial<Pick<OrgDepartment, 'name' | 'parent_id' | 'leader_id' | 'sort_order'>>,
): Promise<OrgDepartment> {
  return http
    .put<OrgDepartment>(`/api/org/departments/${id}`, payload)
    .then((response) => response.data)
}

export function deleteDepartment(id: number): Promise<void> {
  return http.delete(`/api/org/departments/${id}`).then(() => undefined)
}

export function listUsers(params: UserQuery = {}): Promise<OrgUser[]> {
  return http
    .get<{ items: OrgUser[] }>('/api/org/users', { params })
    .then((response) => response.data.items)
}

export function createUser(payload: {
  username: string
  password: string
  display_name: string
  department_id: number | null
  role_ids: number[]
  status: 'active' | 'disabled'
}): Promise<OrgUser> {
  return http.post<OrgUser>('/api/org/users', payload).then((response) => response.data)
}

export function updateUser(
  id: number,
  payload: {
    display_name?: string
    department_id?: number | null
    role_ids?: number[]
    status?: 'active' | 'disabled'
  },
): Promise<OrgUser> {
  return http
    .put<OrgUser>(`/api/org/users/${id}`, payload)
    .then((response) => response.data)
}

export function resetUserPassword(id: number, newPassword: string): Promise<void> {
  return http
    .post(`/api/org/users/${id}/reset-password`, { new_password: newPassword })
    .then(() => undefined)
}

export function setUserStatus(id: number, status: 'active' | 'disabled'): Promise<void> {
  return http.post(`/api/org/users/${id}/status`, { status }).then(() => undefined)
}

export function deleteUser(id: number): Promise<void> {
  return http.delete(`/api/org/users/${id}`).then(() => undefined)
}

export function listRoles(): Promise<OrgRole[]> {
  return http.get<{ items: OrgRole[] }>('/api/org/roles').then((response) => response.data.items)
}

export function listPermissionCatalog(): Promise<PermissionCatalogItem[]> {
  return http
    .get<{ items: PermissionCatalogItem[] }>('/api/org/permissions')
    .then((response) => response.data.items)
}

export function createRole(payload: {
  role_name: string
  role_code: string
  description?: string
  permission_codes?: string[]
}): Promise<OrgRole> {
  return http.post<OrgRole>('/api/org/roles', payload).then((response) => response.data)
}

export function updateRole(
  id: number,
  payload: { role_name?: string; description?: string },
): Promise<OrgRole> {
  return http.put<OrgRole>(`/api/org/roles/${id}`, payload).then((response) => response.data)
}

export function deleteRole(id: number): Promise<void> {
  return http.delete(`/api/org/roles/${id}`).then(() => undefined)
}

export function setRolePermissions(id: number, permissionCodes: string[]): Promise<OrgRole> {
  return http
    .post<OrgRole>(`/api/org/roles/${id}/permissions`, {
      permission_codes: permissionCodes,
    })
    .then((response) => response.data)
}
