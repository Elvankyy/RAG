<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="error-page">
    <div class="error-card kb-card">
      <div class="error-icon">403</div>
      <h1>暂无访问权限</h1>
      <p>当前账号没有该页面或知识单元的数据权限。可联系知识管理员为自己的部门、角色或账号补充授权。</p>
      <div class="actions">
        <el-button type="primary" @click="router.push('/chat')">返回工作台</el-button>
        <el-button @click="router.back()">回到上一页</el-button>
      </div>
      <span class="error-hint">HTTP 403 · 操作权限或数据权限不足</span>
    </div>
  </div>
</template>

<style scoped>
.error-page {
  display: grid;
  place-items: center;
  min-height: calc(100vh - 118px);
}

.error-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 520px;
  padding: 48px 40px;
  text-align: center;
}

.error-icon {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background: var(--kb-warning-soft);
  color: var(--kb-warning);
  font-family: var(--kb-font-num);
  font-size: 20px;
  font-weight: 700;
}

h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

p {
  margin: 0;
  color: var(--kb-text-2);
  font-size: 12px;
  line-height: 1.7;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 6px;
}

.error-hint {
  color: var(--kb-text-3);
  font-family: var(--kb-font-num);
  font-size: 9.5px;
}
</style>
