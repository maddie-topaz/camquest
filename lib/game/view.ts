// What the UI needs on top of the raw save: derived, content-aware facts
// (level, quest statuses, what's missing) computed once on the server so
// every screen reads the same answers.

import { achievements } from "./content/achievements";
import { getCompanionDefinition, type CompanionStat } from "./content/companions";
import { encounters } from "./content/encounters";
import {
  items,
  getItem,
  type ItemDefinition,
  type ItemKind,
  type ItemTrait,
} from "./content/items";
import { levelProgress } from "./content/levels";
import { quests } from "./content/quests";
import { canStartQuest, pendingGrants, questStatus } from "./rules";
import type { GrantRecord, QuestStatus, Requirements, SaveFile } from "./types";

export type InventoryView = {
  id: string;
  name: string;
  description: string;
  unlockHint: string;
  icon: string;
  color: string;
  tilt: string;
  quantity: number;
  kind: ItemKind;
  traits: ItemTrait[];
};

export type PendingGrantView = GrantRecord & {
  name: string;
  description: string;
  icon: string;
  color: string;
  tilt: string;
  sortOrder: number;
};

export type QuestView = {
  slug: string;
  status: QuestStatus;
  missing: Requirements;
  completions: number;
  completedAt?: string;
};

export type AchievementView = {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  unlockedAt?: string;
};

export type EquippedItemView = {
  itemId: string;
  name: string;
  icon: string;
  color: string;
};

export type CompanionView = {
  id: string;
  name: string;
  species: string;
  companionClass: string;
  icon: string;
  color: string;
  title?: string;
  bio?: string;
  stats: CompanionStat[];
  xp: number;
  level: ReturnType<typeof levelProgress>;
  registeredAt: string;
  equipped: EquippedItemView[];
  // Owned items this companion could equip but hasn't yet — drives the
  // "equip" picker without the UI needing to recompute eligibility.
  equippable: InventoryView[];
};

export type EncounterView = {
  id: string;
  name: string;
  description: string;
  maxScore: number;
  plays: number;
  bestScore: number;
  lastAt?: string;
};

export type SaveView = {
  save: SaveFile;
  level: ReturnType<typeof levelProgress>;
  inventory: InventoryView[];
  pendingGrants: PendingGrantView[];
  quests: Record<string, QuestView>;
  achievements: AchievementView[];
  encounters: EncounterView[];
  companions: CompanionView[];
};

const toInventoryView = (item: ItemDefinition, save: SaveFile): InventoryView => ({
  id: item.id,
  name: item.name,
  description: item.description,
  unlockHint: item.unlockHint,
  icon: item.icon,
  color: item.color,
  tilt: item.tilt,
  quantity: save.player.inventory[item.id]?.quantity ?? 0,
  kind: item.kind,
  traits: item.traits ?? [],
});

const sortedItems = items.slice().sort((a, b) => a.sortOrder - b.sortOrder);

export const buildView = (save: SaveFile): SaveView => ({
  save,
  level: levelProgress(save.player.xp),
  inventory: sortedItems.map((item) => toInventoryView(item, save)),
  pendingGrants: pendingGrants(save)
    .flatMap((grant) => {
      const item = getItem(grant.itemId);
      return item
        ? [
            {
              ...grant,
              name: item.name,
              description: item.description,
              icon: item.icon,
              color: item.color,
              tilt: item.tilt,
              sortOrder: item.sortOrder,
            },
          ]
        : [];
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
    color: achievement.color,
    unlockedAt: save.player.achievements[achievement.id]?.unlockedAt,
  })),
  encounters: encounters.map((encounter) => {
    const record = save.player.encounters?.[encounter.id];
    return {
      id: encounter.id,
      name: encounter.name,
      description: encounter.description,
      maxScore: encounter.maxScore,
      plays: record?.plays ?? 0,
      bestScore: record?.bestScore ?? 0,
      lastAt: record?.lastAt,
    };
  }),
  companions: Object.values(save.player.companions ?? {}).map((companion) => {
    const def = getCompanionDefinition(companion.id);
    const equippedIds = save.player.equipment?.[companion.id] ?? [];
    return {
      id: companion.id,
      name: companion.name,
      species: companion.species,
      companionClass: def?.companionClass ?? "Companion",
      icon: def?.icon ?? "PawPrint",
      color: def?.color ?? "#f0b8d2",
      title: def?.title,
      bio: def?.bio,
      stats: def?.stats ?? [],
      xp: companion.xp,
      level: levelProgress(companion.xp),
      registeredAt: companion.registeredAt,
      equipped: equippedIds.flatMap((itemId) => {
        const item = getItem(itemId);
        return item
          ? [{ itemId: item.id, name: item.name, icon: item.icon, color: item.color }]
          : [];
      }),
      equippable: sortedItems
        .filter(
          (item) =>
            item.traits?.includes("equippable") &&
            item.equippableBy?.includes(companion.id) &&
            !equippedIds.includes(item.id) &&
            (save.player.inventory[item.id]?.quantity ?? 0) > 0,
        )
        .map((item) => toInventoryView(item, save)),
    };
  }),
});
