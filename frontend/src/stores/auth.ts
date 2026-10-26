import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { login as loginApi, logout as logoutApi, me as meApi } from '@/api/auth'
import type { LoginPayload, LoginResult, UserInfo } from '@/types/api'
import { clearToken, getToken, setToken } from '@/utils/token'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(getToken() ?? '')
  const user = ref<UserInfo | null>(null)
  const permissions = ref<string[]>([])
  const isLoading = ref(false)
  const isAuthenticated = computed(() => Boolean(token.value))

  function hasPermission(code?: string): boolean {
    if (!code) {
      return true
    }
    return permissions.value.includes(code)
  }

  function hasAnyPermission(codes: string[]): boolean {
    return codes.some((code) => permissions.value.includes(code))
  }

  async function login(payload: LoginPayload): Promise<LoginResult> {
    isLoading.value = true
    try {
      const result = await loginApi(payload)
      token.value = result.access_token
      setToken(result.access_token)
      user.value = result.user_info
      permissions.value = result.permissions
      return result
    } finally {
      isLoading.value = false
    }
  }

  async function fetchMe(): Promise<UserInfo | null> {
    if (!token.value) {
      return null
    }
    const info = await meApi()
    user.value = info
    permissions.value = info.permissions
    return info
  }

  async function logout(): Promise<void> {
    try {
      if (token.value) {
        await logoutApi()
      }
    } catch {
      // 登出接口失败不应阻塞本地清理
    } finally {
      token.value = ''
      user.value = null
      permissions.value = []
      clearToken()
    }
  }

  return {
    token,
    user,
    permissions,
    isLoading,
    isAuthenticated,
    hasPermission,
    hasAnyPermission,
    login,
    fetchMe,
    logout,
  }
})
