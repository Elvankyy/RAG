<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ChatDotRound,
  CopyDocument,
  Delete,
  Link,
  MagicStick,
  Paperclip,
  Plus,
  Promotion,
  Refresh,
  VideoPause,
  Warning,
} from '@element-plus/icons-vue'
import dayjs from 'dayjs'

import CitationCard from '@/components/chat/CitationCard.vue'
import MarkdownRenderer from '@/components/chat/MarkdownRenderer.vue'
import PermissionNotice from '@/components/chat/PermissionNotice.vue'
import { useChatStore } from '@/stores/chat'
import type { ChatMessage } from '@/types/chat'

const chat = useChatStore()
const draft = ref('')
const messagesRef = ref<HTMLElement>()

const suggestions = [
  '报销流程是什么？',
  '如何申请 VPN 权限？',
  '年假有多少天？',
  '出差住宿标准是多少？',
]

const activeTitle = computed(() => chat.currentSession?.title || '新的对话')
const lastCitations = computed(() => chat.lastAssistant?.citations ?? [])
const lastFaqHit = computed(() => Boolean(chat.lastAssistant?.faqHit))
const hasMessages = computed(() => chat.messages.length > 0)
const streamTick = computed(
  () =>
    `${chat.isStreaming}-${chat.messages.length}-${chat.messages
      .map((message) => message.content.length)
      .join(',')}`,
)

onMounted(() => {
  void chat.loadSessions()
})

watch(streamTick, async () => {
  await nextTick()
  scrollToBottom()
})

watch(
  () => chat.currentSessionId,
  async () => {
    await nextTick()
    scrollToBottom()
  },
)

function scrollToBottom(): void {
  const element = messagesRef.value
  if (element) {
    element.scrollTop = element.scrollHeight
  }
}

function formatTime(iso: string): string {
  return dayjs(iso).format('MM-DD HH:mm')
}

async function handleSend(text?: string): Promise<void> {
  const question = (text ?? draft.value).trim()
  if (!question || chat.isStreaming) {
    return
  }
  draft.value = ''
  await nextTick()
  scrollToBottom()
  await chat.send(question)
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void handleSend()
  }
}

async function handleDelete(sessionId: string, title: string): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除会话「${title}」？删除后消息不可恢复。`, '删除会话', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await chat.removeSession(sessionId)
    ElMessage.success('会话已删除')
  } catch {
    // 取消删除
  }
}

async function handleCopy(message: ChatMessage): Promise<void> {
  try {
    await navigator.clipboard.writeText(message.content)
    ElMessage.success('已复制回答')
  } catch {
    ElMessage.warning('复制失败，请手动选择文本')
  }
}

function handleApply(): void {
  ElMessage.info('权限申请将在后续模块实现，请联系知识管理员')
}

function handleRegenerate(): void {
  if (chat.lastUserQuestion) {
    void handleSend(chat.lastUserQuestion)
  }
}

function handleFeedback(kind: 'up' | 'down'): void {
  ElMessage.success(kind === 'up' ? '感谢反馈' : '已记录，我们会持续优化')
}
</script>

<template>
  <div class="chat-layout">
    <aside class="session-panel kb-card">
      <div class="session-header">
        <span>历史会话</span>
        <button type="button" class="new-session" title="新建会话" @click="chat.startNewSession()">
          <el-icon :size="14"><Plus /></el-icon>
        </button>
      </div>

      <div class="session-list">
        <button
          v-for="session in chat.sessions"
          :key="session.id"
          type="button"
          class="session-item"
          :class="{ 'is-active': session.id === chat.currentSessionId }"
          @click="chat.openSession(session.id)"
        >
          <span class="session-main">
            <span class="session-title">{{ session.title }}</span>
            <span class="session-time">{{ formatTime(session.updated_at) }}</span>
          </span>
          <span
            class="session-delete"
            title="删除会话"
            @click.stop="handleDelete(session.id, session.title)"
          >
            <el-icon :size="12"><Delete /></el-icon>
          </span>
        </button>
        <p v-if="chat.sessions.length === 0" class="session-empty">暂无历史会话</p>
      </div>

      <p class="session-footer">仅展示本人会话 · 最多 50 条</p>
    </aside>

    <section class="chat-panel kb-card">
      <header class="chat-header">
        <div class="title-block">
          <h2>{{ activeTitle }}</h2>
          <div class="badges">
            <span class="badge success">SSE 流式</span>
            <span class="badge primary">{{ lastCitations.length }} 条引用</span>
            <span class="badge neutral">{{ lastFaqHit ? 'FAQ 命中' : 'FAQ 未命中' }}</span>
          </div>
        </div>
        <span class="header-spacer" />
        <el-tooltip content="回答仅基于当前账号被授权的知识" placement="bottom">
          <button type="button" class="header-action" title="权限说明">
            <el-icon :size="15"><Warning /></el-icon>
          </button>
        </el-tooltip>
        <button
          v-if="chat.currentSessionId"
          type="button"
          class="header-action"
          title="删除当前会话"
          @click="handleDelete(chat.currentSessionId, activeTitle)"
        >
          <el-icon :size="15"><Delete /></el-icon>
        </button>
      </header>

      <div ref="messagesRef" class="messages">
        <div v-if="chat.isLoadingMessages" class="loading">正在加载会话…</div>

        <el-alert
          v-else-if="chat.error && !hasMessages"
          :title="chat.error"
          type="error"
          show-icon
          :closable="false"
        />

        <div v-else-if="!hasMessages" class="empty">
          <div class="empty-icon">
            <el-icon :size="26"><ChatDotRound /></el-icon>
          </div>
          <h3>开始一次知识问答</h3>
          <p>回答只基于当前账号被授权的知识单元；未授权内容会以数量提示，不会进入上下文。</p>
          <div class="suggestions">
            <button
              v-for="item in suggestions"
              :key="item"
              type="button"
              class="suggestion"
              @click="handleSend(item)"
            >
              {{ item }}
            </button>
          </div>
        </div>

        <template v-else>
          <div
            v-for="message in chat.messages"
            :key="message.id"
            class="message"
            :class="message.role"
          >
            <template v-if="message.role === 'user'">
              <div class="user-bubble">{{ message.content }}</div>
            </template>

            <template v-else>
              <div class="assistant-avatar">AI</div>
              <div class="assistant-body">
                <div
                  v-if="message.status === 'streaming' && !message.content"
                  class="typing"
                >
                  正在检索并生成回答…
                </div>
                <template v-else>
                  <MarkdownRenderer :content="message.content" />
                  <span
                    v-if="message.status === 'streaming'"
                    class="stream-cursor"
                    aria-hidden="true"
                  />
                </template>

                <div v-if="message.citations.length" class="citations">
                  <CitationCard
                    v-for="citation in message.citations"
                    :key="citation.index"
                    :citation="citation"
                  />
                </div>

                <PermissionNotice
                  v-if="message.unauthorizedCount > 0"
                  :count="message.unauthorizedCount"
                  @apply="handleApply"
                />

                <el-alert
                  v-if="message.status === 'error'"
                  :title="message.error || '生成失败，请稍后重试'"
                  type="error"
                  show-icon
                  :closable="false"
                />

                <div class="message-actions">
                  <button type="button" class="action" @click="handleCopy(message)">
                    <el-icon :size="12"><CopyDocument /></el-icon>
                    复制
                  </button>
                  <button
                    v-if="!chat.isStreaming && message === chat.lastAssistant"
                    type="button"
                    class="action"
                    @click="handleRegenerate"
                  >
                    <el-icon :size="12"><Refresh /></el-icon>
                    重新生成
                  </button>
                  <button type="button" class="action" @click="handleFeedback('up')">有帮助</button>
                  <button type="button" class="action" @click="handleFeedback('down')">没帮助</button>
                  <span v-if="message.status === 'stopped'" class="meta-text">已停止生成</span>
                  <span v-if="message.usage" class="meta-text usage">
                    {{ message.usage.total_tokens }} tokens ·
                    {{ message.faqHit ? 'FAQ 缓存命中' : '模型生成' }}
                  </span>
                </div>
              </div>
            </template>
          </div>
        </template>
      </div>

      <div class="composer">
        <div class="input-box">
          <textarea
            v-model="draft"
            maxlength="1000"
            rows="3"
            placeholder="继续追问，或换一种说法…"
            @keydown="handleKeydown"
          />
          <div class="tools">
            <span class="tool" title="附件（后续实现）">
              <el-icon :size="13"><Paperclip /></el-icon>
            </span>
            <span class="tool" title="引用范围：仅授权知识">
              <el-icon :size="13"><Link /></el-icon>
            </span>
            <span class="tool" title="提示词（后续实现）">
              <el-icon :size="13"><MagicStick /></el-icon>
            </span>
            <span class="tool-spacer" />
            <span class="model-tag">deepseek-chat · 仅授权知识</span>
            <span class="char-count">{{ draft.length }}/1000</span>
            <el-button
              v-if="chat.isStreaming"
              type="danger"
              plain
              size="small"
              :icon="VideoPause"
              @click="chat.stop()"
            >
              停止
            </el-button>
            <el-button
              v-else
              type="primary"
              size="small"
              :icon="Promotion"
              :disabled="!draft.trim()"
              @click="handleSend()"
            >
              发送
            </el-button>
          </div>
        </div>
        <p class="composer-hint">
          Enter 发送 · Shift+Enter 换行 · 回答仅基于授权知识，未授权内容不会进入上下文
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.chat-layout {
  display: flex;
  gap: 16px;
  height: calc(100vh - 62px - 56px);
  min-height: 600px;
}

.session-panel {
  display: flex;
  width: 248px;
  flex: 0 0 248px;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  overflow: hidden;
}

.session-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 4px 6px;
  color: var(--kb-text);
  font-size: 12.5px;
  font-weight: 600;
}

.new-session {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 7px;
  background: var(--kb-primary-soft);
  color: var(--kb-primary);
  cursor: pointer;
}

.session-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.session-item:hover {
  background: #f5f7fb;
}

.session-item.is-active {
  background: var(--kb-primary-soft);
}

.session-main {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.session-title {
  overflow: hidden;
  color: var(--kb-text);
  font-size: 12px;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-item.is-active .session-title {
  color: var(--kb-primary);
  font-weight: 500;
}

.session-time {
  color: var(--kb-text-3);
  font-family: var(--kb-font-num);
  font-size: 9.5px;
}

.session-delete {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  border-radius: 5px;
  color: var(--kb-text-3);
  opacity: 0;
}

.session-item:hover .session-delete {
  opacity: 1;
}

.session-delete:hover {
  background: var(--kb-danger-soft);
  color: var(--kb-danger);
}

.session-empty {
  margin: 12px 0;
  color: var(--kb-text-3);
  font-size: 11px;
  text-align: center;
}

.session-footer {
  margin: 0;
  padding: 4px;
  color: var(--kb-text-3);
  font-size: 9.5px;
}

.chat-panel {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 58px;
  flex: 0 0 58px;
  padding: 0 18px;
  border-bottom: 1px solid var(--kb-border);
}

.title-block {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.title-block h2 {
  overflow: hidden;
  margin: 0;
  color: var(--kb-text);
  font-size: 13.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badges {
  display: flex;
  gap: 6px;
  align-items: center;
}

.badge {
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 9.5px;
}

.badge.success {
  background: var(--kb-success-soft);
  color: var(--kb-success);
}

.badge.primary {
  background: var(--kb-primary-soft);
  color: var(--kb-primary);
}

.badge.neutral {
  background: #f2f4f7;
  color: var(--kb-text-3);
}

.header-spacer {
  flex: 1;
}

.header-action {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 7px;
  background: #f5f7fb;
  color: var(--kb-text-2);
  cursor: pointer;
}

.header-action:hover {
  background: #eef2f7;
}

.messages {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  padding: 16px 18px;
  overflow-y: auto;
}

.loading {
  margin: auto;
  color: var(--kb-text-3);
  font-size: 12px;
}

.empty {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  text-align: center;
}

.empty-icon {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border-radius: 14px;
  background: var(--kb-primary-soft);
  color: var(--kb-primary);
}

.empty h3 {
  margin: 4px 0 0;
  color: var(--kb-text);
  font-size: 15px;
  font-weight: 600;
}

.empty p {
  max-width: 460px;
  margin: 0;
  color: var(--kb-text-3);
  font-size: 11.5px;
  line-height: 1.7;
}

.suggestions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 6px;
}

.suggestion {
  padding: 6px 10px;
  border: 1px solid var(--kb-border);
  border-radius: 8px;
  background: #f9fafb;
  color: var(--kb-text-2);
  font-size: 11px;
  cursor: pointer;
}

.suggestion:hover {
  border-color: var(--kb-primary);
  color: var(--kb-primary);
}

.message {
  display: flex;
  gap: 10px;
}

.message.user {
  justify-content: flex-end;
}

.user-bubble {
  max-width: 560px;
  padding: 9px 13px;
  border-radius: 10px;
  background: var(--kb-primary);
  color: #fff;
  font-size: 12.5px;
  line-height: 1.65;
  white-space: pre-wrap;
}

.assistant-avatar {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex: 0 0 26px;
  border-radius: 8px;
  background: var(--kb-sidebar);
  color: #60a5fa;
  font-family: var(--kb-font-num);
  font-size: 9.5px;
  font-weight: 700;
}

.assistant-body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 9px;
}

.typing {
  color: var(--kb-text-3);
  font-size: 12px;
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}

.stream-cursor {
  display: inline-block;
  width: 6px;
  height: 13px;
  margin-left: 2px;
  border-radius: 1px;
  background: var(--kb-primary);
  animation: blink 1s steps(2, start) infinite;
  vertical-align: text-bottom;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

.citations {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.message-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--kb-text-3);
  font-size: 10px;
  cursor: pointer;
}

.action:hover {
  color: var(--kb-primary);
}

.meta-text {
  color: var(--kb-text-3);
  font-size: 9.5px;
}

.usage {
  margin-left: auto;
  font-family: var(--kb-font-num);
}

.composer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--kb-border);
}

.input-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 9px 11px;
  border: 1px solid var(--kb-border);
  border-radius: 10px;
  background: #f9fafb;
}

.input-box:focus-within {
  border-color: var(--kb-primary);
  background: #fff;
}

textarea {
  width: 100%;
  min-height: 54px;
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--kb-text);
  font-family: var(--kb-font);
  font-size: 12.5px;
  line-height: 1.7;
  resize: none;
}

textarea::placeholder {
  color: var(--kb-text-3);
}

.tools {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tool {
  display: grid;
  place-items: center;
  color: var(--kb-text-3);
  cursor: default;
}

.tool-spacer {
  flex: 1;
}

.model-tag,
.char-count {
  color: var(--kb-text-3);
  font-family: var(--kb-font-num);
  font-size: 9.5px;
}

.composer-hint {
  margin: 0;
  color: var(--kb-text-3);
  font-size: 9.5px;
}
</style>
