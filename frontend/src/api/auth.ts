import { http } from '@/api/http'
import type {
  ChangePasswordPayload,
  LoginPayload,
  LoginResult,
  UserInfo,
} from '@/types/api'

export function login(payload: LoginPayload): Promise<LoginResult> {
  return http.post<LoginResult>('/api/auth/login', payload).then((response) => response.data)
}

export function me(): Promise<UserInfo> {
  return http.get<UserInfo>('/api/auth/me').then((response) => response.data)
}

export function logout(): Promise<void> {
  return http.post('/api/auth/logout').then(() => undefined)
}

export function changePassword(payload: ChangePasswordPayload): Promise<void> {
  return http.put('/api/auth/password', payload).then(() => undefined)
}
