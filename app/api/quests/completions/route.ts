import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

// pg needs the Node runtime, not Edge.
export const runtime = 'nodejs'

export async function GET() {
  try {
    const result = await query('SELECT DISTINCT slug FROM quest_completions', [])
    return NextResponse.json({ slugs: result.rows.map((row) => row.slug as string) })
  } catch (error) {
    console.error('Failed to load quest completions', error)
    return NextResponse.json({ error: 'Failed to load completions' }, { status: 500 })
  }
}
