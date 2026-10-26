import type { Router } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

export function setupRouterGuards(router: Router): void {
  router.beforeEach(async (to) => {
    const auth = useAuthStore()
    const appTitle = import.meta.env.VITE_APP_TITLE || '知识库管理平台'
    document.title = to.meta.title ? `${to.meta.title} · ${appTitle}` : appTitle

    if (to.meta.public) {
      if (to.name === 'login' && auth.isAuthenticated) {
        return { path: '/chat' }
      }
      return true
    }

    if (!auth.isAuthenticated) {
      return { path: '/login', query: { redirect: to.fullPath } }
    }

    if (!auth.user) {
      try {
        await auth.fetchMe()
      } catch {
        await auth.logout()
        return { path: '/login', query: { redirect: to.fullPath } }
      }
    }

    if (to.meta.menu && !auth.hasPermission(to.meta.menu)) {
      return { path: '/403' }
    }

    if (to.meta.permission && !auth.hasPermission(to.meta.permission)) {
      return { path: '/403' }
    }

    return true
  })
}
