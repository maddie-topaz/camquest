// Quest definitions live in lib/adventures.ts alongside their step copy.
// This module is the game engine's view of them.

import { adventures, type Adventure } from '@/lib/adventures'

export type QuestDefinition = Adventure

export const quests: QuestDefinition[] = adventures

export const questsBySlug: Record<string, QuestDefinition> = Object.fromEntries(quests.map((quest) => [quest.slug, quest]))

export const getQuest = (slug: string) => questsBySlug[slug]
