import axios from 'axios'

import { clearToken, getToken } from '@/utils/token'
import type { ApiErrorBody } from '@/types/api'

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 15000,
})

http.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError<ApiErrorBody>(error)) {
      if (error.response?.status === 401) {
        clearToken()
        if (!window.location.pathname.startsWith('/login')) {
          const redirect = encodeURIComponent(
            `${window.location.pathname}${window.location.search}`,
          )
          window.location.assign(`/login?redirect=${redirect}`)
        }
      }
      const message = error.response?.data?.message || error.message || '请求失败'
      return Promise.reject(new Error(message))
    }
    return Promise.reject(error instanceof Error ? error : new Error('请求失败'))
  },
)
