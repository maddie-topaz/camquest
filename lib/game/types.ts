// The save file, the events that build it, and the commands that produce
// events. Everything here is plain data: no classes, no DB types, so the
// same code runs in the reducer tests, on the server, and in the browser.

export type PlayerId = string

export const SAVE_VERSION = 1

// ---------------------------------------------------------------------------
// Save file
// ---------------------------------------------------------------------------

export type ItemStack = { quantity: number }

// One row per grant ever made. A grant stays "pending" until the player
// presses Accept on the START reveal; re-arming clears acceptedAt again.
export type GrantRecord = {
  key: string
  itemId: string
  quantity: number
  reason: string
  questSlug?: string
  at: string
  acceptedAt?: string
}

export type QuestStatus = 'locked' | 'available' | 'in-progress' | 'completed'

export type QuestSave = {
  step: number
  answers: Record<string, string>
  unlockedSteps: string[]
  startedAt?: string
  completedAt?: string
  // How many times the quest has been completed. Repeatable quests can
  // grant rewards each time; one-shot rewards check for the first.
  completions: number
}

export type SaveFile = {
  version: number
  playerId: PlayerId
  // Sequence number of the last event applied. The store uses it to know
  // which events still need replaying on top of a snapshot.
  seq: number
  updatedAt: string
  player: {
    name: string
    xp: number
    traits: Record<string, number>
    inventory: Record<string, ItemStack>
    achievements: Record<string, { unlockedAt: string }>
    grants: GrantRecord[]
  }
  world: {
    unlockedQuests: string[]
    discoveredLocations: string[]
    secrets: string[]
  }
  quests: Record<string, QuestSave>
}

// ---------------------------------------------------------------------------
// Events: the only way the save changes. Append-only, replayable.
// ---------------------------------------------------------------------------

export type GameEventPayload =
  | { type: 'player.created'; name: string; traits?: Record<string, number> }
  | { type: 'player.renamed'; name: string }
  | { type: 'item.granted'; itemId: string; quantity: number; reason: string; questSlug?: string }
  | { type: 'item.consumed'; itemId: string; quantity: number; reason: string; questSlug?: string }
  | { type: 'grants.accepted'; grantKeys: string[] }
  | { type: 'grants.rearmed'; grantKeys?: string[] }
  | { type: 'xp.gained'; amount: number; reason: string; questSlug?: string }
  | { type: 'trait.changed'; trait: string; delta: number; reason: string; questSlug?: string }
  | { type: 'achievement.unlocked'; achievementId: string; reason: string }
  | { type: 'achievement.revoked'; achievementId: string; reason: string }
  | { type: 'quest.unlocked'; slug: string; reason: string }
  | { type: 'quest.started'; slug: string }
  | { type: 'quest.progressed'; slug: string; step: number; answers: Record<string, string>; unlockedSteps: string[] }
  | { type: 'quest.completed'; slug: string; answers: Record<string, string> }
  | { type: 'quest.reset'; slug: string; reason: string }
  | { type: 'location.discovered'; locationId: string; reason: string }
  | { type: 'secret.found'; secretId: string; reason: string }

export type GameEventType = GameEventPayload['type']

// An event as stored: the payload plus bookkeeping. `key` is the
// idempotency key: committing the same key twice is a no-op.
export type GameEvent = {
  seq: number
  key: string
  at: string
  payload: GameEventPayload
}

// What a caller hands the store. `key` is optional: when omitted the store
// mints one, which is right for events that should never dedupe (a
// progress save) and wrong for ones that must (a starter grant).
export type NewGameEvent = { key?: string; payload: GameEventPayload }

// ---------------------------------------------------------------------------
// Commands: what the UI (and later XState) asks for. The command handler
// validates against the current save and turns each into zero or more
// events, or rejects it with a reason.
// ---------------------------------------------------------------------------

export type Command =
  | { type: 'quest.start'; slug: string }
  | { type: 'quest.progress'; slug: string; step: number; answers: Record<string, string>; unlockedSteps: string[] }
  | { type: 'quest.complete'; slug: string; answers: Record<string, string> }
  | { type: 'item.consume'; itemId: string; quantity: number; reason: string; questSlug?: string; operationId: string }
  | { type: 'grants.accept'; grantKeys: string[] }

export type CommandRejection = { code: string; message: string; missing?: Requirements }

export type CommandResult =
  | { ok: true; events: NewGameEvent[] }
  | { ok: false; rejection: CommandRejection }

// ---------------------------------------------------------------------------
// Content shapes shared by definitions and rules
// ---------------------------------------------------------------------------

export type Requirements = {
  items?: string[]
  questsCompleted?: string[]
  // Minimum trait values, e.g. { chaos: 5 }
  traits?: Record<string, number>
  level?: number
  achievements?: string[]
  // The quest only appears once something has unlocked it (a reward, an
  // admin unlock). Without this flag a quest is available as soon as its
  // other requirements are met.
  unlock?: boolean
}

export type Rewards = {
  xp?: number
  items?: { itemId: string; quantity?: number }[]
  unlocks?: string[]
  achievements?: string[]
  traits?: Record<string, number>
  locations?: string[]
  secrets?: string[]
}
