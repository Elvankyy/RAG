import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { deleteSession as deleteSessionApi, listMessages, listSessions } from '@/api/chat'
import { streamChat } from '@/utils/sse'
import type {
  ChatMessage,
  ChatSession,
  Citation,
  TokenUsage,
} from '@/types/chat'

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function createAssistantMessage(): ChatMessage {
  return {
    id: createId('a'),
    role: 'assistant',
    content: '',
    citations: [],
    unauthorizedCount: 0,
    status: 'streaming',
  }
}

export const useChatStore = defineStore('chat', () => {
  const sessions = ref<ChatSession[]>([])
  const currentSessionId = ref<string | null>(null)
  const messages = ref<ChatMessage[]>([])
  const isStreaming = ref(false)
  const isLoadingMessages = ref(false)
  const error = ref('')

  let controller: AbortController | null = null

  const currentSession = computed(
    () => sessions.value.find((session) => session.id === currentSessionId.value) ?? null,
  )
  const lastAssistant = computed(
    () => [...messages.value].reverse().find((message) => message.role === 'assistant') ?? null,
  )
  const lastUserQuestion = computed(
    () => [...messages.value].reverse().find((message) => message.role === 'user')?.content ?? '',
  )

  async function loadSessions(): Promise<void> {
    try {
      sessions.value = await listSessions()
      if (!currentSessionId.value && sessions.value.length > 0) {
        await openSession(sessions.value[0].id)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '会话加载失败'
    }
  }

  async function openSession(sessionId: string): Promise<void> {
    currentSessionId.value = sessionId
    isLoadingMessages.value = true
    error.value = ''
    try {
      messages.value = await listMessages(sessionId)
    } catch (err) {
      messages.value = []
      error.value = err instanceof Error ? err.message : '消息加载失败'
    } finally {
      isLoadingMessages.value = false
    }
  }

  function startNewSession(): void {
    if (isStreaming.value) {
      stop()
    }
    currentSessionId.value = null
    messages.value = []
    error.value = ''
  }

  async function send(question: string): Promise<void> {
    const content = question.trim()
    if (!content || isStreaming.value) {
      return
    }

    error.value = ''
    messages.value.push({
      id: createId('u'),
      role: 'user',
      content,
      citations: [],
      unauthorizedCount: 0,
      status: 'done',
    })
    const assistant = createAssistantMessage()
    messages.value.push(assistant)
    const assistantIndex = messages.value.length - 1

    isStreaming.value = true
    controller = new AbortController()

    const updateAssistant = (patch: Partial<ChatMessage>): void => {
      const target = messages.value[assistantIndex]
      if (target) {
        Object.assign(target, patch)
      }
    }

    try {
      await streamChat(
        { question: content, session_id: currentSessionId.value },
        {
          onMeta: (meta) => {
            updateAssistant({
              citations: meta.citations,
              unauthorizedCount: meta.unauthorized_count,
              faqHit: meta.faq_hit,
            })
            if (!currentSessionId.value) {
              currentSessionId.value = meta.session_id
            }
          },
          onDelta: (piece) => {
            const target = messages.value[assistantIndex]
            if (target) {
              target.content += piece
            }
          },
          onUsage: (usage: TokenUsage) => {
            updateAssistant({ usage })
          },
          onDone: (done) => {
            updateAssistant({
              citations: done.citations,
              unauthorizedCount: done.unauthorized_count,
              faqHit: done.faq_hit,
              usage: {
                prompt_tokens: done.prompt_tokens ?? 0,
                completion_tokens: done.completion_tokens ?? 0,
                total_tokens: done.total_tokens,
                token_source: done.token_source,
              },
              status: 'done',
            })
            if (!currentSessionId.value) {
              currentSessionId.value = done.session_id
            }
          },
          onError: (message) => {
            updateAssistant({ status: 'error', error: message })
            error.value = message
          },
        },
        controller.signal,
      )
      const target = messages.value[assistantIndex]
      if (target && target.status === 'streaming') {
        target.status = 'done'
      }
      await loadSessions()
    } catch (err) {
      const target = messages.value[assistantIndex]
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (target) {
          target.status = 'stopped'
        }
      } else {
        const message = err instanceof Error ? err.message : '生成失败'
        updateAssistant({ status: 'error', error: message })
        error.value = message
      }
    } finally {
      isStreaming.value = false
      controller = null
    }
  }

  function stop(): void {
    controller?.abort()
    isStreaming.value = false
  }

  async function removeSession(sessionId: string): Promise<void> {
    try {
      await deleteSessionApi(sessionId)
      sessions.value = sessions.value.filter((session) => session.id !== sessionId)
      if (currentSessionId.value === sessionId) {
        startNewSession()
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '删除会话失败'
    }
  }

  function citationsOf(message: ChatMessage | null): Citation[] {
    return message?.citations ?? []
  }

  return {
    sessions,
    currentSessionId,
    currentSession,
    messages,
    isStreaming,
    isLoadingMessages,
    error,
    lastAssistant,
    lastUserQuestion,
    loadSessions,
    openSession,
    startNewSession,
    send,
    stop,
    removeSession,
    citationsOf,
  }
})
