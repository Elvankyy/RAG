<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="error-page">
    <div class="error-card kb-card">
      <div class="error-icon">404</div>
      <h1>页面不存在</h1>
      <p>访问的地址可能已变更、被删除，或链接输入有误。请检查地址后重试。</p>
      <div class="actions">
        <el-button type="primary" @click="router.push('/chat')">返回工作台</el-button>
        <el-button @click="router.back()">回到上一页</el-button>
      </div>
      <span class="error-hint">HTTP 404 · 资源不存在或已删除</span>
    </div>
  </div>
</template>

<style scoped>
.error-page {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 24px;
  background: var(--kb-bg);
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
  background: var(--kb-primary-soft);
  color: var(--kb-primary);
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
