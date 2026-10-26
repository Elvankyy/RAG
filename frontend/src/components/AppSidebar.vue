<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { SwitchButton } from '@element-plus/icons-vue'

import { menuGroups } from '@/config/menu'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const visibleGroups = computed(() =>
  menuGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => auth.hasPermission(item.menu)),
    }))
    .filter((group) => group.items.length > 0),
)

const displayName = computed(() => auth.user?.display_name ?? '未登录')
const roleName = computed(() => auth.user?.roles?.[0]?.role_name ?? '—')
const avatarChar = computed(() => displayName.value.slice(0, 1))

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(`${path}/`)
}

async function handleLogout(): Promise<void> {
  await auth.logout()
  ElMessage.success('已退出登录')
  await router.push('/login')
}
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-logo">知</div>
      <div class="brand-text">
        <span class="brand-name">知识库平台</span>
        <span class="brand-sub">Knowledge OS</span>
      </div>
    </div>

    <nav class="nav">
      <div v-for="group in visibleGroups" :key="group.label" class="nav-group">
        <div class="nav-group-label">{{ group.label }}</div>
        <router-link
          v-for="item in group.items"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ 'is-active': isActive(item.path) }"
        >
          <el-icon class="nav-icon" :size="17">
            <component :is="item.icon" />
          </el-icon>
          <span>{{ item.label }}</span>
        </router-link>
      </div>
    </nav>

    <div class="user-card">
      <button class="user-main" type="button" @click="router.push('/profile')">
        <span class="avatar">{{ avatarChar }}</span>
        <span class="user-text">
          <span class="user-name">{{ displayName }}</span>
          <span class="user-role">{{ roleName }}</span>
        </span>
      </button>
      <button class="logout" type="button" title="退出登录" @click="handleLogout">
        <el-icon :size="15"><SwitchButton /></el-icon>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  width: 232px;
  flex: 0 0 232px;
  height: 100%;
  padding: 22px 14px;
  background: var(--kb-sidebar);
  color: var(--kb-sidebar-text);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  margin-bottom: 26px;
  padding: 0 4px;
}

.brand-logo {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: var(--kb-primary);
  color: #fff;
  font-size: 17px;
  font-weight: 700;
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.brand-name {
  color: #f8fafc;
  font-size: 15px;
  font-weight: 600;
}

.brand-sub {
  color: #64748b;
  font-family: var(--kb-font-num);
  font-size: 9.5px;
  letter-spacing: 1.2px;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 18px;
  overflow-y: auto;
}

.nav-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-group-label {
  padding-left: 10px;
  color: #475569;
  font-size: 10.5px;
  letter-spacing: 1px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 38px;
  padding: 0 10px;
  border-radius: 8px;
  color: #cbd5e1;
  font-size: 13px;
  transition: background 0.15s ease, color 0.15s ease;
}

.nav-item:hover {
  background: var(--kb-sidebar-hover);
  color: #fff;
}

.nav-item.is-active {
  background: #1e293b;
  color: #fff;
}

.nav-icon {
  color: inherit;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  padding: 10px;
  border-radius: 10px;
  background: #111c33;
}

.user-main {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.avatar {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border-radius: 50%;
  background: #1d4ed8;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}

.user-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.user-name {
  overflow: hidden;
  color: #f8fafc;
  font-size: 12.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-role {
  color: #64748b;
  font-size: 10.5px;
}

.logout {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex: 0 0 26px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
}

.logout:hover {
  background: #1e293b;
  color: #fff;
}
</style>
