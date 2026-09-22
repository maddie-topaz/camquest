import { NextResponse } from 'next/server'
import { withConnection } from '@/lib/db'
import { listPendingGrants } from '@/lib/inventory'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const { result, pending } = await withConnection(async (client) => ({
      result: await client.query(
        `SELECT items.id, items.name, items.description, items.unlock_hint,
                items.icon, items.color, items.tilt,
                COALESCE(inventory.quantity, 0)::int AS quantity
         FROM inventory_items AS items
         LEFT JOIN player_inventory AS inventory ON inventory.item_id = items.id
         ORDER BY items.sort_order, items.id`,
        [],
      ),
      // Grants the player hasn't pressed Accept on yet. START uses this to
      // decide whether to show the reveal at all.
      pending: await listPendingGrants(client),
    }))

    return NextResponse.json({
      pending,
      items: result.rows.map((row) => ({
        id: row.id as string,
        name: row.name as string,
        description: row.description as string,
        unlockHint: row.unlock_hint as string,
        icon: row.icon as string,
        color: row.color as string,
        tilt: row.tilt as string,
        quantity: Number(row.quantity),
      })),
    })
  } catch (error) {
    console.error('Failed to load inventory', error)
    return NextResponse.json({ error: 'Failed to load inventory' }, { status: 500 })
  }
}
