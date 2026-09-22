// The quest engine. A command is what the UI wants to happen; the handler
// checks it against the save and answers with the events that make it so,
// or a rejection. It never writes anything: the store commits the events,
// which keeps this pure and testable.

import { getItem } from './content/items'
import { getQuest, type QuestDefinition } from './content/quests'
import { applyEvent } from './reducer'
import { canConsume, canStartQuest, hasCompleted, newlyEarnedAchievements, pendingGrants } from './rules'
import type { Command, CommandResult, GameEvent, NewGameEvent, Requirements, SaveFile } from './types'

const reject = (code: string, message: string, missing?: Requirements): CommandResult =>
  ({ ok: false, rejection: { code, message, missing } })

// Applies not-yet-committed events to a save so later checks (achievement
// conditions, a second reward) see the intermediate state. Sequence
// numbers here are provisional; the store assigns the real ones.
const simulate = (save: SaveFile, events: NewGameEvent[], at: string) =>
  events.reduce<SaveFile>(
    (state, event, index) => applyEvent(state, { seq: state.seq + index + 1, key: event.key ?? `sim:${index}`, at, payload: event.payload } as GameEvent),
    save,
  )

// Rewards for finishing a quest, as events. First-completion rewards are
// keyed by slug so a replayed completion can never grant them twice;
// repeatable quests get a fresh key per completion.
const rewardEvents = (save: SaveFile, quest: QuestDefinition, completionIndex: number): NewGameEvent[] => {
  const rewards = quest.rewards
  if (!rewards) return []
  const keyPrefix = quest.repeatable ? `quest:${quest.slug}:${completionIndex}` : `quest:${quest.slug}`
  const events: NewGameEvent[] = []
  const reason = 'quest_complete'

  if (rewards.xp) events.push({ key: `${keyPrefix}:xp`, payload: { type: 'xp.gained', amount: rewards.xp, reason, questSlug: quest.slug } })
  for (const reward of rewards.items ?? []) {
    if (!getItem(reward.itemId)) continue
    events.push({ key: `${keyPrefix}:item:${reward.itemId}`, payload: { type: 'item.granted', itemId: reward.itemId, quantity: reward.quantity ?? 1, reason, questSlug: quest.slug } })
  }
  for (const [trait, delta] of Object.entries(rewards.traits ?? {})) {
    events.push({ key: `${keyPrefix}:trait:${trait}`, payload: { type: 'trait.changed', trait, delta, reason, questSlug: quest.slug } })
  }
  for (const slug of rewards.unlocks ?? []) {
    if (save.world.unlockedQuests.includes(slug)) continue
    events.push({ key: `${keyPrefix}:unlock:${slug}`, payload: { type: 'quest.unlocked', slug, reason: `${reason}:${quest.slug}` } })
  }
  for (const achievementId of rewards.achievements ?? []) {
    if (save.player.achievements[achievementId]) continue
    events.push({ key: `${keyPrefix}:achievement:${achievementId}`, payload: { type: 'achievement.unlocked', achievementId, reason: `${reason}:${quest.slug}` } })
  }
  for (const locationId of rewards.locations ?? []) {
    if (save.world.discoveredLocations.includes(locationId)) continue
    events.push({ key: `${keyPrefix}:location:${locationId}`, payload: { type: 'location.discovered', locationId, reason: `${reason}:${quest.slug}` } })
  }
  for (const secretId of rewards.secrets ?? []) {
    if (save.world.secrets.includes(secretId)) continue
    events.push({ key: `${keyPrefix}:secret:${secretId}`, payload: { type: 'secret.found', secretId, reason: `${reason}:${quest.slug}` } })
  }
  return events
}

// Condition-based achievements the resulting save now earns.
const achievementEvents = (save: SaveFile, events: NewGameEvent[], at: string): NewGameEvent[] =>
  newlyEarnedAchievements(simulate(save, events, at)).map((achievementId) => ({
    key: `achievement:${achievementId}`,
    payload: { type: 'achievement.unlocked' as const, achievementId, reason: 'condition' },
  }))

export const handleCommand = (save: SaveFile, command: Command, at = new Date().toISOString()): CommandResult => {
  switch (command.type) {
    case 'quest.start': {
      const quest = getQuest(command.slug)
      if (!quest) return reject('unknown-quest', `No such quest: ${command.slug}`)
      if (quest.status === 'coming-soon') return reject('coming-soon', `${quest.title} isn't ready yet`)
      const gate = canStartQuest(save, quest)
      if (!gate.ok) return reject('locked', `${quest.title} is locked`, gate.missing)
      if (save.quests[command.slug]?.startedAt && !hasCompleted(save, command.slug)) return { ok: true, events: [] }
      return { ok: true, events: [{ payload: { type: 'quest.started', slug: command.slug } }] }
    }

    case 'quest.progress': {
      const quest = getQuest(command.slug)
      if (!quest) return reject('unknown-quest', `No such quest: ${command.slug}`)
      const gate = canStartQuest(save, quest)
      if (!gate.ok) return reject('locked', `${quest.title} is locked`, gate.missing)
      if (command.step < 0 || command.step > quest.steps.length) return reject('bad-step', `Step ${command.step} is out of range`)
      return {
        ok: true,
        events: [{ payload: { type: 'quest.progressed', slug: command.slug, step: command.step, answers: command.answers, unlockedSteps: command.unlockedSteps } }],
      }
    }

    case 'quest.complete': {
      const quest = getQuest(command.slug)
      if (!quest) return reject('unknown-quest', `No such quest: ${command.slug}`)
      const gate = canStartQuest(save, quest)
      if (!gate.ok) return reject('locked', `${quest.title} is locked`, gate.missing)
      const alreadyDone = hasCompleted(save, command.slug)
      if (alreadyDone && !quest.repeatable) return reject('already-completed', `${quest.title} is already complete`)
      const completionIndex = (save.quests[command.slug]?.completions ?? 0) + 1
      const events: NewGameEvent[] = [
        { payload: { type: 'quest.completed', slug: command.slug, answers: command.answers } },
        ...rewardEvents(save, quest, completionIndex),
      ]
      return { ok: true, events: [...events, ...achievementEvents(save, events, at)] }
    }

    case 'item.consume': {
      if (!command.operationId || command.operationId.length > 100) return reject('bad-operation', 'operationId is required')
      if (!Number.isInteger(command.quantity) || command.quantity < 1 || command.quantity > 99) return reject('bad-quantity', 'quantity must be 1–99')
      const check = canConsume(save, command.itemId, command.quantity)
      if (!check.ok) return reject(check.code, check.message)
      const events: NewGameEvent[] = [
        { key: `consume:${command.operationId}`, payload: { type: 'item.consumed', itemId: command.itemId, quantity: command.quantity, reason: command.reason, questSlug: command.questSlug } },
      ]
      return { ok: true, events: [...events, ...achievementEvents(save, events, at)] }
    }

    case 'grants.accept': {
      const pending = new Set(pendingGrants(save).map((grant) => grant.key))
      const grantKeys = command.grantKeys.filter((key) => pending.has(key))
      if (grantKeys.length === 0) return { ok: true, events: [] }
      const events: NewGameEvent[] = [{ payload: { type: 'grants.accepted', grantKeys } }]
      return { ok: true, events: [...events, ...achievementEvents(save, events, at)] }
    }

    default: {
      const _exhaustive: never = command
      return reject('unknown-command', 'Unknown command')
    }
  }
}
