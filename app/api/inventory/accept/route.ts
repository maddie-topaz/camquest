import { NextRequest, NextResponse } from 'next/server'
import { withConnection } from '@/lib/db'
import { acceptGrants, resetAcceptedGrants } from '@/lib/inventory'

export const runtime = 'nodejs'

const parseEventIds = (value: unknown) =>
  Array.isArray(value) && value.every((id) => Number.isInteger(id) && id > 0) ? (value as number[]) : null

// Marks the listed grants as accepted. The reveal sends exactly the ids it
// showed, so a grant that lands mid-animation stays pending for next time.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const eventIds = parseEventIds(body?.eventIds)
  if (!eventIds || eventIds.length === 0 || eventIds.length > 200) {
    return NextResponse.json({ error: 'eventIds must be a non-empty array of grant ids' }, { status: 400 })
  }

  try {
    const accepted = await withConnection((client) => acceptGrants(client, eventIds))
    return NextResponse.json({ accepted })
  } catch (error) {
    console.error('Failed to accept inventory grants', error)
    return NextResponse.json({ error: 'Failed to accept items' }, { status: 500 })
  }
}

// Debug aid: puts grants back to pending so the START reveal replays them.
// No body re-arms everything; `{ eventIds }` re-arms just those.
export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const eventIds = body?.eventIds === undefined ? undefined : parseEventIds(body.eventIds)
  if (eventIds === null) {
    return NextResponse.json({ error: 'eventIds must be an array of grant ids' }, { status: 400 })
  }

  try {
    const rearmed = await withConnection((client) => resetAcceptedGrants(client, eventIds))
    return NextResponse.json({ rearmed })
  } catch (error) {
    console.error('Failed to re-arm inventory grants', error)
    return NextResponse.json({ error: 'Failed to re-arm items' }, { status: 500 })
  }
}
