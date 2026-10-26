<script setup lang="ts">
import { Warning } from '@element-plus/icons-vue'

defineProps<{ count: number }>()
const emit = defineEmits<{ apply: [] }>()
</script>

<template>
  <div class="notice">
    <el-icon class="icon" :size="14"><Warning /></el-icon>
    <p>
      另有 <strong>{{ count }}</strong> 个相关知识单元因权限限制未展示，请联系知识管理员申请访问。
    </p>
    <button type="button" class="link" @click="emit('apply')">申请权限</button>
  </div>
</template>

<style scoped>
.notice {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid #fde9c4;
  border-radius: 8px;
  background: var(--kb-warning-soft);
}

.icon {
  flex: 0 0 auto;
  color: var(--kb-warning);
}

p {
  flex: 1;
  margin: 0;
  color: #b54708;
  font-size: 10.5px;
  line-height: 1.6;
}

strong {
  font-weight: 600;
}

.link {
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--kb-warning);
  font-size: 10.5px;
  font-weight: 500;
  cursor: pointer;
}
</style>
