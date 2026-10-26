export interface OrgDepartment {
  id: number
  parent_id: number | null
  name: string
  leader_id: number | null
  leader_name: string
  member_count: number
  sort_order: number
}

export interface OrgRole {
  id: number
  role_name: string
  role_code: string
  description: string
  user_count: number
  permission_codes: string[]
  is_builtin?: boolean
}

export interface OrgUser {
  id: number
  username: string
  display_name: string
  department_id: number | null
  department_name: string
  status: 'active' | 'disabled'
  role_ids: number[]
  role_names: string[]
  created_at: string
}

export interface PermissionCatalogItem {
  code: string
  name: string
  type: 'menu' | 'action'
  module: string
}
