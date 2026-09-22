// Companion flavor: everything about a companion that isn't save state.
// The save (player.companions[id]) holds the instance — name, species,
// xp, when it was registered; this holds the curated presentation on top
// of it — class, avatar, color, title, stats. One entry per companion id
// a quest might register via `rewards.companion`.

export type CompanionStat = {
  id: string;
  name: string;
  value: number;
  max: number;
  // Its own restrained accent, same pattern as traits/tendencies.
  color: string;
};

export type CompanionDefinition = {
  id: string;
  // Companion "class/type" line, e.g. "Feline".
  companionClass: string;
  // Name of a lucide icon registered in companionIcons (app/game-ui/icons.ts).
  icon: string;
  color: string;
  title?: string;
  // A line of flavor text for the profile card.
  bio?: string;
  stats?: CompanionStat[];
};

export const companions: CompanionDefinition[] = [
  {
    id: "kitana",
    companionClass: "Feline",
    icon: "Cat",
    color: "#ff75c8",
    title: "The Soft Guardian",
    bio: "A gentle ragdoll familiar whose gifts lie in comfort and companionship rather than battle. Few have tested her in combat. Many have benefited from the cuddles.",
    stats: [
      { id: "luck", name: "Luck", value: 7, max: 10, color: "#b98bff" },
      { id: "stealth", name: "Stealth", value: 6, max: 10, color: "#4ce0b3" },
      { id: "loyalty", name: "Loyalty", value: 9, max: 10, color: "#ff9ecb" },
    ],
  },
];

export const companionsById: Record<string, CompanionDefinition> =
  Object.fromEntries(companions.map((companion) => [companion.id, companion]));

export const getCompanionDefinition = (id: string) => companionsById[id];
