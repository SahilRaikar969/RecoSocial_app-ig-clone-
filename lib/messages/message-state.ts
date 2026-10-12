export type ThreadMessage = {
  id: string
  thread_id: string
  sender_id: string
  body: string
  created_at: string
  delivery?: 'sending' | 'failed'
}

export function compareMessages(a: ThreadMessage, b: ThreadMessage) {
  return a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
}

// The server row always wins over its optimistic copy, regardless of event order.
export function mergeMessages(current: ThreadMessage[], incoming: ThreadMessage[], threadId: string) {
  const byId = new Map(current.filter(message => message.thread_id === threadId).map(message => [message.id, message]))
  for (const message of incoming) {
    if (message.thread_id !== threadId) continue
    const existing = byId.get(message.id)
    if (existing && !existing.delivery && message.delivery) continue
    byId.set(message.id, message)
  }
  return [...byId.values()].sort(compareMessages)
}

export function messageCursor(message: ThreadMessage) {
  return { id: message.id, created_at: message.created_at }
}

export function isMessage(value: unknown): value is ThreadMessage {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return ['id', 'thread_id', 'sender_id', 'body', 'created_at'].every(key => typeof row[key] === 'string')
    && Number.isFinite(Date.parse(row.created_at as string))
}
