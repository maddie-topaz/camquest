// Browser-side access to the save. Thin: the server owns every rule.

import type { Command, CommandRejection, GameEvent } from './types'
import type { SaveView } from './view'

export type { SaveView, InventoryView, PendingGrantView, QuestView, AchievementView } from './view'

export class CommandRejectedError extends Error {
  rejection: CommandRejection
  view: SaveView
  constructor(rejection: CommandRejection, view: SaveView) {
    super(rejection.message)
    this.name = 'CommandRejectedError'
    this.rejection = rejection
    this.view = view
  }
}

export const loadSave = async (timeoutMs = 20000): Promise<SaveView> => {
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch('/api/game/save', { cache: 'no-store', signal: controller.signal })
    if (!response.ok) throw new Error('Failed to load save')
    return (await response.json()) as SaveView
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Save request timed out')
    throw error
  } finally {
    globalThis.clearTimeout(timeout)
  }
}

export const sendCommand = async (command: Command): Promise<{ applied: GameEvent[]; view: SaveView }> => {
  const response = await fetch('/api/game/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command }),
  })
  const data = await response.json().catch(() => null)
  if (response.status === 409 && data?.rejection) throw new CommandRejectedError(data.rejection, data.view)
  if (!response.ok) throw new Error(data?.error || 'Command failed')
  return data
}

export const adminAction = async (body: Record<string, unknown>): Promise<{ applied: GameEvent[]; view: SaveView }> => {
  const response = await fetch('/api/game/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error || 'Admin action failed')
  return data
}
