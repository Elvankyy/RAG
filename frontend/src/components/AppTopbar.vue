<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Bell, Search, ArrowDown } from '@element-plus/icons-vue'

import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const pageTitle = computed(() => route.meta.title ?? '')
const displayName = computed(() => auth.user?.display_name ?? '未登录')
const avatarChar = computed(() => displayName.value.slice(0, 1))

function handleSearch(): void {
  ElMessage.info('全局搜索将在后续模块实现')
}

async function handleCommand(command: string): Promise<void> {
  if (command === 'profile') {
    await router.push('/profile')
    return
  }
  if (command === 'logout') {
    await auth.logout()
    ElMessage.success('已退出登录')
    await router.push('/login')
  }
}
</script>

<template>
  <header class="topbar">
    <div class="breadcrumb">
      <span class="crumb-root">知识库平台</span>
      <span class="crumb-sep">/</span>
      <span class="crumb-page">{{ pageTitle }}</span>
    </div>

    <div class="spacer" />

    <div class="search" @click="handleSearch">
      <el-icon :size="14"><Search /></el-icon>
      <span>搜索知识单元 / 用户</span>
    </div>

    <button class="icon-button" type="button" title="通知">
      <el-icon :size="16"><Bell /></el-icon>
    </button>

    <el-dropdown trigger="click" @command="handleCommand">
      <button class="profile-trigger" type="button">
        <span class="avatar">{{ avatarChar }}</span>
        <el-icon :size="12" class="chevron"><ArrowDown /></el-icon>
      </button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="profile">个人中心</el-dropdown-item>
          <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  gap: 14px;
  height: 62px;
  flex: 0 0 62px;
  padding: 0 28px;
  background: var(--kb-surface);
  border-bottom: 1px solid var(--kb-border);
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
}

.crumb-root {
  color: var(--kb-text-3);
}

.crumb-sep {
  color: #cbd5e1;
}

.crumb-page {
  color: var(--kb-text-2);
  font-weight: 500;
}

.spacer {
  flex: 1;
}

.search {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 240px;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--kb-border);
  border-radius: 8px;
  background: var(--kb-bg);
  color: var(--kb-text-3);
  font-size: 12px;
  cursor: pointer;
}

.icon-button {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 8px;
  background: var(--kb-bg);
  color: var(--kb-text-2);
  cursor: pointer;
}

.icon-button:hover {
  background: #eef2f7;
}

.profile-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.avatar {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #1d4ed8;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}

.chevron {
  color: var(--kb-text-3);
}
</style>
