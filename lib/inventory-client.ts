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

export async function loadInventory(): Promise<InventoryItem[]> {
  const response = await fetch('/api/inventory')
  if (!response.ok) throw new Error('Failed to load inventory')
  const data = await response.json()
  return Array.isArray(data?.items) ? data.items : []
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
