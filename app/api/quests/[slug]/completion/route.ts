import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// pg needs the Node runtime, not Edge.
export const runtime = 'nodejs'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  try {
    const result = await query(
      `SELECT id, slug, answers, completed_at
       FROM quest_completions
       WHERE slug = $1
       ORDER BY completed_at DESC
       LIMIT 1`,
      [slug],
    )
    return NextResponse.json({ completion: result.rows[0] ?? null })
  } catch (error) {
    console.error('Failed to load quest completion', error)
    return NextResponse.json({ error: 'Failed to load completion' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  try {
    await query('DELETE FROM quest_completions WHERE slug = $1', [slug])
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Failed to reset quest completion', error)
    return NextResponse.json({ error: 'Failed to reset completion' }, { status: 500 })
  }
}
