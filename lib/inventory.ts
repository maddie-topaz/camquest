import type { ClientBase } from 'pg'

export type InventoryReward = { itemId: string; quantity: number }

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

// Rewards are granted on the server when a quest completion is recorded.
// The event key used by grantQuestRewards makes every reward idempotent, so
// replaying a completion can never duplicate an item.
//
// No quest currently grants loot; add an entry keyed by quest slug (and the
// matching row in scripts/migrate.mjs) to wire one up.
export const questInventoryRewards: Record<string, InventoryReward[]> = {}

// Records a grant and applies it to the player's pack in one statement. The
// event starts unaccepted, so it shows up in the next START reveal until the
// player presses Accept. `eventKey` makes the grant idempotent: a replay with
// the same key is a no-op and returns false.
export const grantItem = async (
  client: ClientBase,
  grant: { itemId: string; quantity: number; reason: string; eventKey: string; questSlug?: string | null },
) => {
  const result = await client.query(
    `WITH granted AS (
       INSERT INTO inventory_events (item_id, delta, event_type, reason, quest_slug, event_key)
       VALUES ($1, $2, 'grant', $3, $4, $5)
       ON CONFLICT (event_key) DO NOTHING
       RETURNING item_id, delta
     )
     INSERT INTO player_inventory (item_id, quantity)
     SELECT item_id, delta FROM granted
     ON CONFLICT (item_id) DO UPDATE
     SET quantity = player_inventory.quantity + EXCLUDED.quantity,
         updated_at = now()
     RETURNING item_id`,
    [grant.itemId, grant.quantity, grant.reason, grant.questSlug ?? null, grant.eventKey],
  )
  return result.rowCount === 1
}

export const grantQuestRewards = async (client: ClientBase, slug: string) => {
  const rewards = questInventoryRewards[slug] || []
  for (const reward of rewards) {
    await grantItem(client, {
      itemId: reward.itemId,
      quantity: reward.quantity,
      reason: 'quest_complete',
      questSlug: slug,
      eventKey: `quest:${slug}:reward:${reward.itemId}`,
    })
  }
}

// Every grant the player hasn't accepted yet, oldest first, joined to the
// item definition so the reveal can render it without a second round trip.
export const listPendingGrants = async (client: ClientBase): Promise<PendingGrant[]> => {
  const result = await client.query(
    `SELECT events.id, events.item_id, events.delta, events.reason, events.created_at,
            items.name, items.description, items.icon, items.color, items.tilt
     FROM inventory_events AS events
     JOIN inventory_items AS items ON items.id = events.item_id
     WHERE events.event_type = 'grant' AND events.accepted_at IS NULL
     ORDER BY items.sort_order, events.created_at, events.id`,
    [],
  )
  return result.rows.map((row) => ({
    eventId: Number(row.id),
    itemId: row.item_id as string,
    name: row.name as string,
    description: row.description as string,
    icon: row.icon as string,
    color: row.color as string,
    tilt: row.tilt as string,
    quantity: Number(row.delta),
    reason: row.reason as string,
    createdAt: new Date(row.created_at as string).toISOString(),
  }))
}

// Stamps the given grants as accepted. Only pending grants are touched, so
// a double-submit is harmless. Returns how many were newly accepted.
export const acceptGrants = async (client: ClientBase, eventIds: number[]) => {
  if (eventIds.length === 0) return 0
  const result = await client.query(
    `UPDATE inventory_events
     SET accepted_at = now()
     WHERE id = ANY($1::bigint[]) AND event_type = 'grant' AND accepted_at IS NULL`,
    [eventIds],
  )
  return result.rowCount ?? 0
}

// Re-arms the reveal by un-stamping grants. With no ids, every grant goes
// back to pending so the next START replays the whole pack. Testing aid.
export const resetAcceptedGrants = async (client: ClientBase, eventIds?: number[]) => {
  const result = eventIds
    ? await client.query(
        `UPDATE inventory_events SET accepted_at = NULL
         WHERE id = ANY($1::bigint[]) AND event_type = 'grant'`,
        [eventIds],
      )
    : await client.query(
        `UPDATE inventory_events SET accepted_at = NULL WHERE event_type = 'grant'`,
        [],
      )
  return result.rowCount ?? 0
}
