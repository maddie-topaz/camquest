// The quest catalogue. Add a quest by creating its file next to these and
// listing it here; the quest log, archive, engine and reset page all read
// this array. Order here is display order.

import { camsGambit } from './cams-gambit'
import { unknownSignal } from './unknown-signal'
import type { QuestDefinition } from './types'

export type { QuestDefinition, QuestFlag, ChallengeStep, MysteryCard } from './types'

export const quests: QuestDefinition[] = [
  unknownSignal,
  camsGambit,
]

export const questsBySlug: Record<string, QuestDefinition> = Object.fromEntries(quests.map((quest) => [quest.slug, quest]))

export const getQuest = (slug: string) => questsBySlug[slug]
