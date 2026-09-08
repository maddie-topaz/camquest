import { NextRequest, NextResponse } from 'next/server'
import { withConnection } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const itemId = typeof body?.itemId === 'string' ? body.itemId : ''
  const quantity = Number.isInteger(body?.quantity) ? Number(body.quantity) : 1
  const questSlug = typeof body?.questSlug === 'string' ? body.questSlug : null
  const operationId = typeof body?.operationId === 'string' ? body.operationId : ''

  if (!itemId || !operationId || operationId.length > 100 || quantity < 1 || quantity > 99) {
    return NextResponse.json({ error: 'A valid itemId, quantity, and operationId are required' }, { status: 400 })
  }

  try {
    const remaining = await withConnection(async (client) => {
      await client.query('BEGIN')
      try {
        const eventKey = `consume:${operationId}`
        const existing = await client.query(
          `SELECT item_id, delta FROM inventory_events WHERE event_key = $1`,
          [eventKey],
        )
        if (existing.rows[0]) {
          if (existing.rows[0]?.item_id !== itemId || Number(existing.rows[0]?.delta) !== -quantity) {
            await client.query('ROLLBACK')
            return { conflict: true as const }
          }
          const current = await client.query('SELECT quantity FROM player_inventory WHERE item_id = $1', [itemId])
          await client.query('COMMIT')
          return { quantity: Number(current.rows[0]?.quantity || 0), replayed: true as const }
        }
        const updated = await client.query(
          `UPDATE player_inventory
           SET quantity = quantity - $2, updated_at = now()
           WHERE item_id = $1 AND quantity >= $2
           RETURNING quantity`,
          [itemId, quantity],
        )
        if (!updated.rows[0]) {
          await client.query('ROLLBACK')
          return null
        }
        try {
          await client.query(
            `INSERT INTO inventory_events (item_id, delta, event_type, reason, quest_slug, event_key)
             VALUES ($1, $2, 'consume', 'quest_use', $3, $4)`,
            [itemId, -quantity, questSlug, eventKey],
          )
        } catch (error) {
          if ((error as { code?: string }).code !== '23505') throw error
          // A concurrent retry won the event key. Roll this decrement back,
          // then return the already-committed result from the winning request.
          await client.query('ROLLBACK')
          const duplicate = await client.query(
            `SELECT item_id, delta FROM inventory_events WHERE event_key = $1`,
            [eventKey],
          )
          if (duplicate.rows[0]?.item_id !== itemId || Number(duplicate.rows[0]?.delta) !== -quantity) {
            return { conflict: true as const }
          }
          const current = await client.query('SELECT quantity FROM player_inventory WHERE item_id = $1', [itemId])
          return { quantity: Number(current.rows[0]?.quantity || 0), replayed: true as const }
        }
        await client.query('COMMIT')
        return { quantity: Number(updated.rows[0].quantity), replayed: false as const }
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    })

    if (remaining === null) {
      return NextResponse.json({ error: 'Item is unavailable or quantity is insufficient' }, { status: 409 })
    }
    if ('conflict' in remaining) {
      return NextResponse.json({ error: 'operationId was already used for a different inventory action' }, { status: 409 })
    }
    return NextResponse.json({ itemId, quantity: remaining.quantity, operationId, replayed: remaining.replayed })
  } catch (error) {
    console.error('Failed to use inventory item', error)
    return NextResponse.json({ error: 'Failed to use inventory item' }, { status: 500 })
  }
}
