export type InventoryItem = {
  id: string
  name: string
  description: string
  unlockHint: string
  icon: string
  color: string
  tilt: string
  quantity: number
}

// A grant the player hasn't accepted yet. One row per grant event, so the
// same item can appear twice if it was gifted twice.
export type PendingGrant = {
  eventId: number
  itemId: string
  name: string
  description: string
  icon: string
  color: string
  tilt: string
  quantity: number
  reason: string
  createdAt: string
}

export type InventorySnapshot = { items: InventoryItem[]; pending: PendingGrant[] }

export async function loadInventory(timeoutMs = 20000): Promise<InventorySnapshot> {
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch('/api/inventory', { cache: 'no-store', signal: controller.signal })
    if (!response.ok) throw new Error('Failed to load inventory')
    const data = await response.json()
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      pending: Array.isArray(data?.pending) ? data.pending : [],
    }
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Inventory request timed out')
    throw error
  } finally {
    globalThis.clearTimeout(timeout)
  }
}

// Called when the player presses Accept on the reveal. Sends exactly the
// grants that were shown, so anything that arrived mid-reveal stays pending.
export async function acceptInventoryGrants(eventIds: number[]) {
  const response = await fetch('/api/inventory/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventIds }),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error || 'Failed to accept items')
  return Number(data?.accepted ?? 0)
}

// Debug aid for the /reset page: puts every grant back to pending so the
// next START replays the full reveal.
export async function rearmInventoryReveal() {
  const response = await fetch('/api/inventory/accept', { method: 'DELETE' })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error || 'Failed to re-arm reveal')
  return Number(data?.rearmed ?? 0)
}

// Future quest screens can call this at the moment an item is committed to a
// choice. The server performs an atomic guarded decrement, so two requests can
// never spend the same last item.
export async function consumeInventoryItem(itemId: string, quantity = 1, questSlug?: string, operationId = crypto.randomUUID()) {
  const response = await fetch('/api/inventory/use', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId, quantity, questSlug, operationId }),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error || 'Failed to use item')
  return data as { itemId: string; quantity: number; operationId: string }
}
