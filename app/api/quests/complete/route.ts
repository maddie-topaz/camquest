import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// pg needs the Node runtime, not Edge.
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const slug = typeof body?.slug === 'string' ? body.slug : null
  const answers =
    body?.answers && typeof body.answers === 'object' && !Array.isArray(body.answers)
      ? (body.answers as Record<string, string>)
      : {}

  if (!slug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 })
  }

  try {
    const result = await query(
      `INSERT INTO quest_completions (slug, answers)
       VALUES ($1, $2)
       RETURNING id, slug, answers, completed_at`,
      [slug, JSON.stringify(answers)],
    )
    return NextResponse.json({ completion: result.rows[0] })
  } catch (error) {
    console.error('Failed to store quest completion', error)
    return NextResponse.json({ error: 'Failed to store completion' }, { status: 500 })
  }
}
