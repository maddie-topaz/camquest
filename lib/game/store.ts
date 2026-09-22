// Persistence for the save file. Two tables:
//
//   game_events  append-only log, one row per event, unique (player, key)
//   game_saves   materialised snapshot of the reducer output + last seq
//
// Reads take the snapshot and replay anything newer. Writes lock the
// player's save row, re-validate against the freshest state, append the
// events, fold them in, and update the snapshot, all in one transaction,
// so two requests can never both spend the last cowbell.

import { randomUUID } from 'node:crypto'
import type { ClientBase } from 'pg'
import { withConnection } from '@/lib/db'
import { handleCommand } from './commands'
import { starterLoadout } from './content/items'
import { applyEvent, emptySave, normaliseSave, replay } from './reducer'
import type { Command, CommandRejection, GameEvent, GameEventPayload, NewGameEvent, PlayerId, SaveFile } from './types'

export const DEFAULT_PLAYER: PlayerId = 'cam'

const rowToEvent = (row: Record<string, unknown>): GameEvent => ({
  seq: Number(row.seq),
  key: row.event_key as string,
  at: new Date(row.created_at as string).toISOString(),
  payload: row.payload as GameEventPayload,
})

// The events that bring a brand-new player into existence. Keyed, so
// running setup twice is harmless.
const bootstrapEvents = (name: string): NewGameEvent[] => [
  { key: 'player:created', payload: { type: 'player.created', name } },
  ...starterLoadout.map((entry) => ({
    key: `starter:${entry.itemId}`,
    payload: { type: 'item.granted' as const, itemId: entry.itemId, quantity: entry.quantity, reason: 'starter_loadout' },
  })),
]

// Snapshot + replay. Caller holds whatever lock it needs.
const loadWithClient = async (client: ClientBase, playerId: PlayerId, forUpdate = false): Promise<SaveFile> => {
  const snapshot = await client.query(
    `SELECT state, last_seq FROM game_saves WHERE player_id = $1${forUpdate ? ' FOR UPDATE' : ''}`,
    [playerId],
  )
  let save: SaveFile = snapshot.rows[0]?.state ? normaliseSave(snapshot.rows[0].state) : emptySave(playerId)
  const lastSeq = Number(snapshot.rows[0]?.last_seq ?? 0)

  const newer = await client.query(
    `SELECT seq, event_key, payload, created_at FROM game_events WHERE player_id = $1 AND seq > $2 ORDER BY seq`,
    [playerId, lastSeq],
  )
  if (newer.rows.length) {
    save = replay(save, newer.rows.map(rowToEvent))
    await client.query(
      `INSERT INTO game_saves (player_id, state, last_seq, updated_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (player_id) DO UPDATE SET state = EXCLUDED.state, last_seq = EXCLUDED.last_seq, updated_at = now()`,
      [playerId, JSON.stringify(save), save.seq],
    )
  }
  return save
}

// Appends events and folds them into the snapshot. Events whose key
// already exists are skipped (idempotency), which is why the reducer
// output is recomputed from what was actually inserted.
const appendWithClient = async (client: ClientBase, save: SaveFile, events: NewGameEvent[]) => {
  let next = save
  const applied: GameEvent[] = []
  for (const event of events) {
    const inserted = await client.query(
      `INSERT INTO game_events (player_id, seq, event_key, payload)
       VALUES ($1, (SELECT COALESCE(MAX(seq), 0) + 1 FROM game_events WHERE player_id = $1), $2, $3)
       ON CONFLICT (player_id, event_key) DO NOTHING
       RETURNING seq, event_key, payload, created_at`,
      [save.playerId, event.key ?? `evt:${randomUUID()}`, JSON.stringify(event.payload)],
    )
    if (!inserted.rows[0]) continue
    const stored = rowToEvent(inserted.rows[0])
    next = applyEvent(next, stored)
    applied.push(stored)
  }
  if (applied.length) {
    await client.query(
      `INSERT INTO game_saves (player_id, state, last_seq, updated_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (player_id) DO UPDATE SET state = EXCLUDED.state, last_seq = EXCLUDED.last_seq, updated_at = now()`,
      [save.playerId, JSON.stringify(next), next.seq],
    )
  }
  return { save: next, applied }
}

const inTransaction = async <T>(fn: (client: ClientBase) => Promise<T>) =>
  withConnection(async (client) => {
    await client.query('BEGIN')
    try {
      const result = await fn(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  })

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const loadSave = (playerId: PlayerId = DEFAULT_PLAYER) =>
  inTransaction((client) => loadWithClient(client, playerId))

// Creates the player if they don't exist yet. Safe to call every time.
export const ensurePlayer = (playerId: PlayerId = DEFAULT_PLAYER, name = 'Cam') =>
  inTransaction(async (client) => {
    const save = await loadWithClient(client, playerId, true)
    if (save.seq > 0) return save
    return (await appendWithClient(client, save, bootstrapEvents(name))).save
  })

export type CommandOutcome =
  | { ok: true; save: SaveFile; applied: GameEvent[] }
  | { ok: false; save: SaveFile; rejection: CommandRejection }

// Validates and applies a command under the player's row lock, so the
// rules always see the freshest save.
export const runCommand = (command: Command, playerId: PlayerId = DEFAULT_PLAYER): Promise<CommandOutcome> =>
  inTransaction(async (client) => {
    const save = await loadWithClient(client, playerId, true)
    const result = handleCommand(save, command)
    if (!result.ok) return { ok: false, save, rejection: result.rejection }
    const { save: next, applied } = await appendWithClient(client, save, result.events)
    return { ok: true, save: next, applied }
  })

// Admin path: append raw events with no rule checks. Used by the debug
// page and the CLI for gifts, resets and re-arms.
export const appendEvents = (events: NewGameEvent[], playerId: PlayerId = DEFAULT_PLAYER) =>
  inTransaction(async (client) => {
    const save = await loadWithClient(client, playerId, true)
    return appendWithClient(client, save, events)
  })

// Full event history, for the admin view and for rebuilding a snapshot.
export const listEvents = (playerId: PlayerId = DEFAULT_PLAYER, limit = 200) =>
  withConnection(async (client) => {
    const result = await client.query(
      `SELECT seq, event_key, payload, created_at FROM game_events WHERE player_id = $1 ORDER BY seq DESC LIMIT $2`,
      [playerId, limit],
    )
    return result.rows.map(rowToEvent)
  })
