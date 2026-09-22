// Pure game rules over a save file. Nothing here mutates or persists; the
// command handler and the UI both ask these questions, and XState guards
// can wrap them directly later.

import { achievements } from "./content/achievements";
import { getItem } from "./content/items";
import { levelForXp } from "./content/levels";
import { getQuest, type QuestDefinition } from "./content/quests";
import type { QuestStatus, Requirements, SaveFile } from "./types";

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

export const playerLevel = (save: SaveFile) => levelForXp(save.player.xp);

export const hasItem = (save: SaveFile, itemId: string, quantity = 1) =>
  (save.player.inventory[itemId]?.quantity ?? 0) >= quantity;

export const hasCompleted = (save: SaveFile, slug: string) =>
  (save.quests[slug]?.completions ?? 0) > 0;

export const hasAchievement = (save: SaveFile, id: string) =>
  Boolean(save.player.achievements[id]);

export const pendingGrants = (save: SaveFile) =>
  save.player.grants.filter((grant) => !grant.acceptedAt);

// ---------------------------------------------------------------------------
// Inventory rules
// ---------------------------------------------------------------------------

export type ConsumeCheck =
  | { ok: true }
  | {
      ok: false;
      code: "unknown-item" | "not-consumable" | "insufficient";
      message: string;
    };

export const canConsume = (
  save: SaveFile,
  itemId: string,
  quantity: number,
): ConsumeCheck => {
  const item = getItem(itemId);
  if (!item)
    return {
      ok: false,
      code: "unknown-item",
      message: `No such item: ${itemId}`,
    };
  if (!item.traits?.includes("consumable"))
    return {
      ok: false,
      code: "not-consumable",
      message: `${item.name} can't be spent`,
    };
  if (!hasItem(save, itemId, quantity))
    return {
      ok: false,
      code: "insufficient",
      message: `Not enough ${item.name}`,
    };
  return { ok: true };
};

// ---------------------------------------------------------------------------
// Equipment rules
// ---------------------------------------------------------------------------

export const isEquipped = (save: SaveFile, ownerId: string, itemId: string) =>
  (save.player.equipment[ownerId] ?? []).includes(itemId);

export type EquipCheck =
  | { ok: true }
  | {
      ok: false;
      code:
        | "unknown-item"
        | "not-equippable"
        | "not-eligible"
        | "insufficient"
        | "already-equipped";
      message: string;
    };

// An item is equipped by reference, not moved: it must stay owned in
// `inventory` the whole time, so unequipping never needs to re-grant it.
export const canEquip = (
  save: SaveFile,
  ownerId: string,
  itemId: string,
): EquipCheck => {
  const item = getItem(itemId);
  if (!item)
    return {
      ok: false,
      code: "unknown-item",
      message: `No such item: ${itemId}`,
    };
  if (!item.traits?.includes("equippable"))
    return {
      ok: false,
      code: "not-equippable",
      message: `${item.name} can't be equipped`,
    };
  if (!item.equippableBy?.includes(ownerId))
    return {
      ok: false,
      code: "not-eligible",
      message: `${item.name} can't be equipped by ${ownerId}`,
    };
  if (!hasItem(save, itemId, 1))
    return {
      ok: false,
      code: "insufficient",
      message: `Not holding ${item.name}`,
    };
  if (isEquipped(save, ownerId, itemId))
    return {
      ok: false,
      code: "already-equipped",
      message: `${item.name} is already equipped`,
    };
  return { ok: true };
};

export type UnequipCheck =
  | { ok: true }
  | { ok: false; code: "not-equipped"; message: string };

export const canUnequip = (
  save: SaveFile,
  ownerId: string,
  itemId: string,
): UnequipCheck => {
  if (!isEquipped(save, ownerId, itemId)) {
    const item = getItem(itemId);
    return {
      ok: false,
      code: "not-equipped",
      message: `${item?.name ?? itemId} isn't equipped`,
    };
  }
  return { ok: true };
};

// ---------------------------------------------------------------------------
// Prerequisites
// ---------------------------------------------------------------------------

// Everything in `requirements` the save does not yet satisfy, in the same
// shape, so the UI can say exactly what's missing. Empty object = met.
export const missingRequirements = (
  save: SaveFile,
  requirements: Requirements | undefined,
  slug?: string,
): Requirements => {
  if (!requirements) return {};
  const missing: Requirements = {};

  const items = (requirements.items ?? []).filter(
    (itemId) => !hasItem(save, itemId),
  );
  if (items.length) missing.items = items;

  const questsCompleted = (requirements.questsCompleted ?? []).filter(
    (other) => !hasCompleted(save, other),
  );
  if (questsCompleted.length) missing.questsCompleted = questsCompleted;

  const traits = Object.entries(requirements.traits ?? {}).filter(
    ([trait, min]) => (save.player.traits[trait] ?? 0) < min,
  );
  if (traits.length) missing.traits = Object.fromEntries(traits);

  const tendencies = Object.entries(requirements.tendencies ?? {}).filter(
    ([tendency, min]) => (save.player.tendencies[tendency] ?? 0) < min,
  );
  if (tendencies.length) missing.tendencies = Object.fromEntries(tendencies);

  if (requirements.level && playerLevel(save) < requirements.level)
    missing.level = requirements.level;

  const achievementsMissing = (requirements.achievements ?? []).filter(
    (id) => !hasAchievement(save, id),
  );
  if (achievementsMissing.length) missing.achievements = achievementsMissing;

  if (requirements.unlock && slug && !save.world.unlockedQuests.includes(slug))
    missing.unlock = true;

  return missing;
};

export const requirementsMet = (missing: Requirements) =>
  Object.keys(missing).length === 0;

export const canStartQuest = (save: SaveFile, quest: QuestDefinition) => {
  const missing = missingRequirements(save, quest.requirements, quest.slug);
  return { ok: requirementsMet(missing), missing };
};

// ---------------------------------------------------------------------------
// Quest status, derived
// ---------------------------------------------------------------------------

export const questStatus = (
  save: SaveFile,
  quest: QuestDefinition,
): QuestStatus => {
  const progress = save.quests[quest.slug];
  if (
    progress &&
    progress.completions > 0 &&
    !(
      quest.repeatable &&
      progress.startedAt &&
      progress.completedAt &&
      progress.startedAt > progress.completedAt
    )
  )
    return "completed";
  if (!canStartQuest(save, quest).ok) return "locked";
  if (progress && (progress.step > 0 || progress.startedAt))
    return "in-progress";
  return "available";
};

export const questStatusFor = (save: SaveFile, slug: string) => {
  const quest = getQuest(slug);
  return quest ? questStatus(save, quest) : "locked";
};

// ---------------------------------------------------------------------------
// Achievements with conditions: which ones the current save now earns
// but hasn't recorded. The command handler appends these after any
// state-changing command.
// ---------------------------------------------------------------------------

export const newlyEarnedAchievements = (save: SaveFile) =>
  achievements
    .filter(
      (achievement) =>
        achievement.condition &&
        !hasAchievement(save, achievement.id) &&
        achievement.condition(save),
    )
    .map((achievement) => achievement.id);
