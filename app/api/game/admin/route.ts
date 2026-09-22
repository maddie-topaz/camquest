import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getItem } from '@/lib/game/content/items'
import { getQuest } from '@/lib/game/content/quests'
import { traitsById } from '@/lib/game/content/traits'
import { appendEvents, listEvents } from '@/lib/game/store'
import type { NewGameEvent } from '@/lib/game/types'
import { buildView } from '@/lib/game/view'

export const runtime = 'nodejs'

// Debug/authoring actions with no rule checks: gifts, resets, re-arms.
// Same trust level as the existing quest-reset endpoint. Each action maps
// to raw events so everything it does is visible in the log.
type AdminAction =
  | { action: 'grant'; itemId: string; quantity?: number; reason?: string }
  | { action: 'rearm' }
  | { action: 'reset-quest'; slug: string }
  | { action: 'unlock-quest'; slug: string }
  | { action: 'xp'; amount: number; reason?: string }
  | { action: 'trait'; trait: string; delta: number; reason?: string }

const toEvents = (body: AdminAction): NewGameEvent[] | string => {
  switch (body.action) {
    case 'grant': {
      const quantity = body.quantity ?? 1
      if (!getItem(body.itemId)) return `No such item: ${body.itemId}`
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return 'quantity must be 1–99'
      return [{ key: `gift:${randomUUID()}`, payload: { type: 'item.granted', itemId: body.itemId, quantity, reason: body.reason || 'gift' } }]
    }
    case 'rearm':
      return [{ payload: { type: 'grants.rearmed' } }]
    case 'reset-quest':
      if (!getQuest(body.slug)) return `No such quest: ${body.slug}`
      return [{ payload: { type: 'quest.reset', slug: body.slug, reason: 'admin' } }]
    case 'unlock-quest':
      if (!getQuest(body.slug)) return `No such quest: ${body.slug}`
      return [{ payload: { type: 'quest.unlocked', slug: body.slug, reason: 'admin' } }]
    case 'xp':
      if (!Number.isInteger(body.amount)) return 'amount must be an integer'
      return [{ payload: { type: 'xp.gained', amount: body.amount, reason: body.reason || 'admin' } }]
    case 'trait':
      if (!traitsById[body.trait]) return `No such trait: ${body.trait}`
      if (!Number.isInteger(body.delta)) return 'delta must be an integer'
      return [{ payload: { type: 'trait.changed', trait: body.trait, delta: body.delta, reason: body.reason || 'admin' } }]
    default:
      return 'Unknown action'
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as AdminAction | null
  if (!body?.action) return NextResponse.json({ error: 'action is required' }, { status: 400 })
  const events = toEvents(body)
  if (typeof events === 'string') return NextResponse.json({ error: events }, { status: 400 })

  try {
    const { save, applied } = await appendEvents(events)
    return NextResponse.json({ applied, view: buildView(save) })
  } catch (error) {
    console.error('Admin action failed', body.action, error)
    return NextResponse.json({ error: 'Admin action failed' }, { status: 500 })
  }
}

// Recent event history, newest first.
export async function GET() {
  try {
    return NextResponse.json({ events: await listEvents() })
  } catch (error) {
    console.error('Failed to list events', error)
    return NextResponse.json({ error: 'Failed to list events' }, { status: 500 })
  }
}
