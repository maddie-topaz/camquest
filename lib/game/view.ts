// What the UI needs on top of the raw save: derived, content-aware facts
// (level, quest statuses, what's missing) computed once on the server so
// every screen reads the same answers.

import { achievements } from './content/achievements'
import { items, getItem } from './content/items'
import { levelProgress } from './content/levels'
import { quests } from './content/quests'
import { canStartQuest, pendingGrants, questStatus } from './rules'
import type { GrantRecord, QuestStatus, Requirements, SaveFile } from './types'

export type InventoryView = {
  id: string
  name: string
  description: string
  unlockHint: string
  icon: string
  color: string
  tilt: string
  quantity: number
  consumable: boolean
}

export type PendingGrantView = GrantRecord & { name: string; description: string; icon: string; color: string; tilt: string; sortOrder: number }

export type QuestView = { slug: string; status: QuestStatus; missing: Requirements; completions: number; completedAt?: string }

export type AchievementView = { id: string; name: string; description: string; icon: string; unlockedAt?: string }

export type SaveView = {
  save: SaveFile
  level: ReturnType<typeof levelProgress>
  inventory: InventoryView[]
  pendingGrants: PendingGrantView[]
  quests: Record<string, QuestView>
  achievements: AchievementView[]
}

export const buildView = (save: SaveFile): SaveView => ({
  save,
  level: levelProgress(save.player.xp),
  inventory: items
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      unlockHint: item.unlockHint,
      icon: item.icon,
      color: item.color,
      tilt: item.tilt,
      quantity: save.player.inventory[item.id]?.quantity ?? 0,
      consumable: Boolean(item.consumable),
    })),
  pendingGrants: pendingGrants(save)
    .flatMap((grant) => {
      const item = getItem(grant.itemId)
      return item ? [{ ...grant, name: item.name, description: item.description, icon: item.icon, color: item.color, tilt: item.tilt, sortOrder: item.sortOrder }] : []
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.at.localeCompare(b.at)),
  quests: Object.fromEntries(
    quests.map((quest) => [
      quest.slug,
      {
        slug: quest.slug,
        status: questStatus(save, quest),
        missing: canStartQuest(save, quest).missing,
        completions: save.quests[quest.slug]?.completions ?? 0,
        completedAt: save.quests[quest.slug]?.completedAt,
      },
    ]),
  ),
  achievements: achievements.map((achievement) => ({
    id: achievement.id,
    name: achievement.name,
    description: achievement.description,
    icon: achievement.icon,
    unlockedAt: save.player.achievements[achievement.id]?.unlockedAt,
  })),
})
