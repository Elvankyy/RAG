<script setup lang="ts">
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

const props = defineProps<{ content: string }>()

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})

const html = computed(() => DOMPurify.sanitize(md.render(props.content || '')))
</script>

<template>
  <div class="markdown" v-html="html" />
</template>

<style scoped>
.markdown {
  color: var(--kb-text-2);
  font-size: 12.5px;
  line-height: 1.75;
  word-break: break-word;
}

.markdown :deep(p) {
  margin: 0 0 8px;
}

.markdown :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown :deep(strong) {
  color: var(--kb-text);
  font-weight: 600;
}

.markdown :deep(ul),
.markdown :deep(ol) {
  margin: 4px 0 8px;
  padding-left: 18px;
}

.markdown :deep(li) {
  margin: 2px 0;
}

.markdown :deep(code) {
  padding: 1px 4px;
  border-radius: 4px;
  background: #eef2f7;
  color: #1e40af;
  font-family: var(--kb-font-num);
  font-size: 11px;
}

.markdown :deep(pre) {
  margin: 8px 0;
  padding: 10px 12px;
  overflow-x: auto;
  border-radius: 8px;
  background: #0f172a;
}

.markdown :deep(pre code) {
  padding: 0;
  background: transparent;
  color: #e2e8f0;
}

.markdown :deep(blockquote) {
  margin: 8px 0;
  padding: 6px 10px;
  border-left: 3px solid var(--kb-primary);
  background: var(--kb-primary-soft);
  color: var(--kb-text-2);
}

.markdown :deep(a) {
  color: var(--kb-primary);
}

.markdown :deep(table) {
  width: 100%;
  margin: 8px 0;
  border-collapse: collapse;
  font-size: 11.5px;
}

.markdown :deep(th),
.markdown :deep(td) {
  padding: 6px 8px;
  border: 1px solid var(--kb-border);
  text-align: left;
}

.markdown :deep(th) {
  background: #f9fafb;
  color: var(--kb-text-2);
  font-weight: 500;
}
</style>
