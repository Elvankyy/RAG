export interface RoleInfo {
  id: number
  role_name: string
  role_code: string
}

export interface DepartmentInfo {
  id: number
  name: string
}

export interface UserInfo {
  id: number
  username: string
  display_name: string
  status: string
  department: DepartmentInfo | null
  roles: RoleInfo[]
  permissions: string[]
}

export interface LoginPayload {
  username: string
  password: string
}

export interface LoginResult {
  access_token: string
  refresh_token: string
  token_type: string
  user_info: UserInfo
  permissions: string[]
}

export interface ChangePasswordPayload {
  old_password: string
  new_password: string
}

export interface ApiErrorBody {
  code?: string
  message?: string
  detail?: unknown
  request_id?: string
}
