import type { SaveFile } from "../types";

// Achievements come in two kinds: `condition` ones the rules engine
// unlocks automatically whenever the save changes, and plain ones that a
// quest grants explicitly through `rewards.achievements`.

export type AchievementDefinition = {
  id: string;
  name: string;
  description: string;
  icon: string;
  // Its own accent, same pattern as traits/tendencies/items — so the
  // Achievements grid doesn't read as one repeated pink tile.
  color: string;
  condition?: (save: SaveFile) => boolean;
};

const completedCount = (save: SaveFile) =>
  Object.values(save.quests).filter((quest) => quest.completions > 0).length;

export const achievements: AchievementDefinition[] = [
  {
    id: "first-quest",
    name: "First quest",
    description: "First quest complete. We always believed in you. Mostly.",
    icon: "Trophy",
    color: "#ffd166",
    condition: (save) => completedCount(save) >= 1,
  },
  {
    id: "blessed-by-kitana",
    name: "Blessed by Kitana",
    description: "A feline blessing issued in your name.",
    icon: "Cat",
    // Matches Kitana's own companion colour.
    color: "#ff75c8",
    condition: (save) =>
      (save.player.inventory["kitanas-blessing"]?.quantity ?? 0) > 0,
  },
  {
    id: "full-pack",
    name: "Full pack",
    description: "Accepted every starter item.",
    icon: "Backpack",
    color: "#4ce0b3",
    condition: (save) =>
      save.player.grants
        .filter((grant) => grant.reason === "starter_loadout")
        .every((grant) => Boolean(grant.acceptedAt)) &&
      save.player.grants.some((grant) => grant.reason === "starter_loadout"),
  },
  {
    id: "level-5",
    name: "Level 5",
    description: "Reached level 5.",
    icon: "Zap",
    color: "#9a6cff",
    condition: (save) => save.player.xp >= 1600,
  },
];

export const achievementsById: Record<string, AchievementDefinition> =
  Object.fromEntries(achievements.map((a) => [a.id, a]));
