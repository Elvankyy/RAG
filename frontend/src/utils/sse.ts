import { getToken } from '@/utils/token'
import type { ChatRequest, ChatStreamHandlers } from '@/types/chat'

interface SseFrame {
  event: string
  data: string
}

function parseFrame(raw: string): SseFrame | null {
  let event = 'message'
  const dataLines: string[] = []
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim())
    }
  }
  if (dataLines.length === 0) {
    return null
  }
  return { event, data: dataLines.join('\n') }
}

export async function streamChat(
  payload: ChatRequest,
  handlers: ChatStreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  const token = getToken()
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  const response = await fetch(`${baseUrl}/api/ai/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
    signal,
  })

  if (!response.ok) {
    let message = `请求失败（${response.status}）`
    try {
      const body = (await response.json()) as { message?: string }
      message = body.message ?? message
    } catch {
      // 保持默认错误信息
    }
    throw new Error(message)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('当前浏览器不支持流式响应')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''

    for (const chunk of chunks) {
      const frame = parseFrame(chunk)
      if (!frame) {
        continue
      }
      let data: unknown
      try {
        data = JSON.parse(frame.data)
      } catch {
        continue
      }
      switch (frame.event) {
        case 'meta':
          handlers.onMeta(data as Parameters<ChatStreamHandlers['onMeta']>[0])
          break
        case 'delta':
          handlers.onDelta((data as { content?: string }).content ?? '')
          break
        case 'usage':
          handlers.onUsage(data as Parameters<ChatStreamHandlers['onUsage']>[0])
          break
        case 'done':
          handlers.onDone(data as Parameters<ChatStreamHandlers['onDone']>[0])
          break
        case 'error':
          handlers.onError((data as { message?: string }).message ?? '生成失败')
          break
        default:
          break
      }
    }
  }
}
