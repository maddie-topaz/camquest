import type { ClientBase } from 'pg'

export type InventoryReward = { itemId: string; quantity: number }

// Rewards are granted on the server when a quest completion is recorded.
// The event key used by grantQuestRewards makes every reward idempotent, so
// replaying a completion can never duplicate an item.
export const questInventoryRewards: Record<string, InventoryReward[]> = {
  'cams-gambit': [
    { itemId: 'lucky-d6', quantity: 1 },
    { itemId: 'ktown-matchbook', quantity: 1 },
    { itemId: 'last-call-coaster', quantity: 1 },
  ],
}

export async function grantQuestRewards(client: ClientBase, slug: string) {
  const rewards = questInventoryRewards[slug] || []

  for (const reward of rewards) {
    await client.query(
      `WITH granted AS (
         INSERT INTO inventory_events (item_id, delta, event_type, reason, quest_slug, event_key)
         VALUES ($1, $2, 'grant', 'quest_complete', $3, $4)
         ON CONFLICT (event_key) DO NOTHING
         RETURNING item_id, delta
       )
       INSERT INTO player_inventory (item_id, quantity)
       SELECT item_id, delta FROM granted
       ON CONFLICT (item_id) DO UPDATE
       SET quantity = player_inventory.quantity + EXCLUDED.quantity,
           updated_at = now()`,
      [reward.itemId, reward.quantity, slug, `quest:${slug}:reward:${reward.itemId}`],
    )
  }
}
