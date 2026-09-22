// The save file is a fold over the event log. `applyEvent` must be pure and
// total: every event type produces a new save, unknown data is tolerated,
// and nothing here talks to the database. That is what makes the log
// replayable and the tests cheap.

import { initialTraits, traitsById } from './content/traits'
import { SAVE_VERSION, type GameEvent, type PlayerId, type QuestSave, type SaveFile } from './types'

export const emptySave = (playerId: PlayerId, at = new Date(0).toISOString()): SaveFile => ({
  version: SAVE_VERSION,
  playerId,
  seq: 0,
  updatedAt: at,
  player: {
    name: 'Player',
    xp: 0,
    traits: initialTraits(),
    inventory: {},
    achievements: {},
    grants: [],
  },
  world: {
    unlockedQuests: [],
    discoveredLocations: [],
    secrets: [],
  },
  quests: {},
})

const emptyQuest = (): QuestSave => ({ step: 0, answers: {}, unlockedSteps: [], completions: 0 })

const addToSet = (list: string[], value: string) => (list.includes(value) ? list : [...list, value])

const clampTrait = (trait: string, value: number) => {
  const def = traitsById[trait]
  if (!def) return value
  return Math.min(def.max, Math.max(def.min, value))
}

const withQuantity = (inventory: SaveFile['player']['inventory'], itemId: string, delta: number) => {
  const next = Math.max(0, (inventory[itemId]?.quantity ?? 0) + delta)
  const { [itemId]: _removed, ...rest } = inventory
  return next === 0 ? rest : { ...rest, [itemId]: { quantity: next } }
}

export const applyEvent = (save: SaveFile, event: GameEvent): SaveFile => {
  const base = { ...save, seq: event.seq, updatedAt: event.at }
  const { payload } = event

  switch (payload.type) {
    case 'player.created':
      return {
        ...base,
        player: { ...base.player, name: payload.name, traits: { ...base.player.traits, ...(payload.traits ?? {}) } },
      }

    case 'player.renamed':
      return { ...base, player: { ...base.player, name: payload.name } }

    case 'item.granted': {
      // Replaying the same grant key twice (an admin re-run, a retried
      // request that slipped past the store) must not double the item.
      if (base.player.grants.some((grant) => grant.key === event.key)) return base
      return {
        ...base,
        player: {
          ...base.player,
          inventory: withQuantity(base.player.inventory, payload.itemId, payload.quantity),
          grants: [
            ...base.player.grants,
            { key: event.key, itemId: payload.itemId, quantity: payload.quantity, reason: payload.reason, questSlug: payload.questSlug, at: event.at },
          ],
        },
      }
    }

    case 'item.consumed':
      return {
        ...base,
        player: { ...base.player, inventory: withQuantity(base.player.inventory, payload.itemId, -payload.quantity) },
      }

    case 'grants.accepted': {
      const keys = new Set(payload.grantKeys)
      return {
        ...base,
        player: {
          ...base.player,
          grants: base.player.grants.map((grant) => (keys.has(grant.key) && !grant.acceptedAt ? { ...grant, acceptedAt: event.at } : grant)),
        },
      }
    }

    case 'grants.rearmed': {
      const keys = payload.grantKeys ? new Set(payload.grantKeys) : null
      return {
        ...base,
        player: {
          ...base.player,
          grants: base.player.grants.map((grant) => {
            if (keys && !keys.has(grant.key)) return grant
            const { acceptedAt: _cleared, ...pending } = grant
            return pending
          }),
        },
      }
    }

    case 'xp.gained':
      return { ...base, player: { ...base.player, xp: Math.max(0, base.player.xp + payload.amount) } }

    case 'trait.changed':
      return {
        ...base,
        player: {
          ...base.player,
          traits: { ...base.player.traits, [payload.trait]: clampTrait(payload.trait, (base.player.traits[payload.trait] ?? 0) + payload.delta) },
        },
      }

    case 'achievement.unlocked':
      if (base.player.achievements[payload.achievementId]) return base
      return {
        ...base,
        player: { ...base.player, achievements: { ...base.player.achievements, [payload.achievementId]: { unlockedAt: event.at } } },
      }

    case 'achievement.revoked': {
      const { [payload.achievementId]: _removed, ...rest } = base.player.achievements
      return { ...base, player: { ...base.player, achievements: rest } }
    }

    case 'quest.unlocked':
      return { ...base, world: { ...base.world, unlockedQuests: addToSet(base.world.unlockedQuests, payload.slug) } }

    case 'quest.started': {
      const current = base.quests[payload.slug] ?? emptyQuest()
      return { ...base, quests: { ...base.quests, [payload.slug]: { ...current, startedAt: current.startedAt ?? event.at } } }
    }

    case 'quest.progressed': {
      const current = base.quests[payload.slug] ?? emptyQuest()
      return {
        ...base,
        quests: {
          ...base.quests,
          [payload.slug]: { ...current, step: payload.step, answers: payload.answers, unlockedSteps: payload.unlockedSteps, startedAt: current.startedAt ?? event.at },
        },
      }
    }

    case 'quest.completed': {
      const current = base.quests[payload.slug] ?? emptyQuest()
      return {
        ...base,
        quests: {
          ...base.quests,
          [payload.slug]: { ...current, answers: payload.answers, completedAt: event.at, completions: current.completions + 1, startedAt: current.startedAt ?? event.at },
        },
      }
    }

    case 'quest.reset': {
      // Progress and completion history go; rewards already granted stay,
      // because the events that granted them are still in the log. Use an
      // explicit revoke/consume if a reset should also claw back loot.
      const { [payload.slug]: _removed, ...rest } = base.quests
      return { ...base, quests: rest }
    }

    case 'location.discovered':
      return { ...base, world: { ...base.world, discoveredLocations: addToSet(base.world.discoveredLocations, payload.locationId) } }

    case 'secret.found':
      return { ...base, world: { ...base.world, secrets: addToSet(base.world.secrets, payload.secretId) } }

    default: {
      // An event type this build doesn't know (written by a newer deploy).
      // Keep the sequence moving so the snapshot stays consistent.
      const _exhaustive: never = payload
      return base
    }
  }
}

export const replay = (save: SaveFile, events: GameEvent[]) => events.reduce(applyEvent, save)
