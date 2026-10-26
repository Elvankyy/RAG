<script setup lang="ts">
import { computed } from 'vue'
import type { UnitPermission } from '@/types/knowledge'

const props = withDefaults(
  defineProps<{
    permissions: UnitPermission[]
    max?: number
  }>(),
  { max: 3 },
)

const visible = computed(() => props.permissions.slice(0, props.max))
const rest = computed(() => Math.max(0, props.permissions.length - props.max))

const classOf = (type: UnitPermission['target_type']): string => {
  if (type === 'global') {
    return 'global'
  }
  if (type === 'department') {
    return 'department'
  }
  if (type === 'role') {
    return 'role'
  }
  return 'user'
}
</script>

<template>
  <div class="chips">
    <span v-if="permissions.length === 0" class="empty">未配置</span>
    <span
      v-for="permission in visible"
      :key="permission.id"
      class="chip"
      :class="classOf(permission.target_type)"
    >
      {{ permission.target_name }}
    </span>
    <span v-if="rest > 0" class="chip more">+{{ rest }}</span>
  </div>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.chip {
  max-width: 120px;
  overflow: hidden;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip.global {
  background: var(--kb-success-soft);
  color: var(--kb-success);
}

.chip.department {
  background: var(--kb-purple-soft);
  color: var(--kb-purple);
}

.chip.role {
  background: var(--kb-primary-soft);
  color: var(--kb-primary);
}

.chip.user {
  background: var(--kb-warning-soft);
  color: #b54708;
}

.chip.more,
.empty {
  background: #f2f4f7;
  color: var(--kb-text-3);
}
</style>
