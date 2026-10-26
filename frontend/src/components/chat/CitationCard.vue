<script setup lang="ts">
import type { Citation } from '@/types/chat'

defineProps<{ citation: Citation }>()
</script>

<template>
  <article class="citation">
    <span class="index">{{ citation.index }}</span>
    <div class="body">
      <div class="title-row">
        <strong>{{ citation.title }}</strong>
        <span class="score">{{ citation.score.toFixed(2) }}</span>
      </div>
      <div class="meta">{{ citation.unit_code }} · {{ citation.category }}</div>
      <p class="snippet">{{ citation.snippet }}</p>
    </div>
  </article>
</template>

<style scoped>
.citation {
  display: flex;
  gap: 8px;
  flex: 1 1 240px;
  min-width: 0;
  padding: 8px 9px;
  border: 1px solid var(--kb-border);
  border-radius: 8px;
  background: #f9fafb;
}

.index {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  border-radius: 5px;
  background: var(--kb-primary-soft);
  color: var(--kb-primary);
  font-family: var(--kb-font-num);
  font-size: 9.5px;
  font-weight: 600;
}

.body {
  min-width: 0;
  flex: 1;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.title-row strong {
  overflow: hidden;
  color: var(--kb-text);
  font-size: 10.5px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.score {
  margin-left: auto;
  color: var(--kb-success);
  font-family: var(--kb-font-num);
  font-size: 8.5px;
}

.meta {
  margin-top: 1px;
  color: var(--kb-text-3);
  font-family: var(--kb-font-num);
  font-size: 8.5px;
}

.snippet {
  display: -webkit-box;
  overflow: hidden;
  margin: 4px 0 0;
  color: var(--kb-text-3);
  font-size: 9.5px;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
</style>
