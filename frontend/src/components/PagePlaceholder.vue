<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const title = computed(() => route.meta.title ?? '页面')
const description = computed(() => route.meta.description ?? '')
const apiHint = computed(() => route.meta.apiHint ?? '')
</script>

<template>
  <div class="placeholder">
    <div class="placeholder-head">
      <div>
        <h1 class="kb-page-title">{{ title }}</h1>
        <p class="kb-page-subtitle">{{ description }}</p>
      </div>
      <el-tag round effect="plain" type="info">骨架已就绪</el-tag>
    </div>

    <div class="placeholder-card kb-card">
      <div class="placeholder-icon">◈</div>
      <h2>页面结构待实现</h2>
      <p>该路由、权限守卫与布局已就位，将在 M07 对应任务中替换为完整页面。</p>
      <div v-if="apiHint" class="api-hint">
        <span class="api-label">对齐接口</span>
        <code>{{ apiHint }}</code>
      </div>
      <div class="next-steps">
        <span>下一步</span>
        <span>接入 MSW mock → 填充页面组件 → 联调真实接口</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.placeholder {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.placeholder-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.placeholder-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 56px 24px;
  text-align: center;
}

.placeholder-icon {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border-radius: 14px;
  background: var(--kb-primary-soft);
  color: var(--kb-primary);
  font-size: 24px;
}

h2 {
  margin: 4px 0 0;
  font-size: 15px;
  font-weight: 600;
}

p {
  max-width: 520px;
  margin: 0;
  color: var(--kb-text-2);
  font-size: 12px;
  line-height: 1.7;
}

.api-hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 6px;
  padding: 8px 12px;
  border: 1px solid var(--kb-border);
  border-radius: 8px;
  background: #f9fafb;
}

.api-label {
  color: var(--kb-text-3);
  font-size: 10.5px;
}

code {
  color: var(--kb-primary);
  font-family: var(--kb-font-num);
  font-size: 10.5px;
}

.next-steps {
  display: flex;
  gap: 8px;
  margin-top: 4px;
  color: var(--kb-text-3);
  font-size: 10.5px;
}

.next-steps span:first-child {
  color: var(--kb-text-2);
  font-weight: 500;
}
</style>
