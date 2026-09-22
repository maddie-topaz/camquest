// Traits: what Cam can *do*. Six core abilities quests can check and
// nudge — unlike tendencies (lib/game/content/tendencies.ts), which track
// how he tends to play. Quests should prefer branching on a trait (an
// alternate clue, an easier passcode, a reroll, a different route) over
// gating on one outright; keep `requirements.traits` for soft nudges, not
// hard blockers.
//
// `color` is this trait's one accent everywhere it appears (profile bar,
// icon, value) — see app/game-ui/colors.ts for how the UI consumes it.

export type TraitDefinition = {
  id: string;
  name: string;
  description: string;
  min: number;
  max: number;
  initial: number;
  color: string;
  // Name of a lucide icon registered in traitIcons (app/game-ui/icons.ts).
  icon: string;
};

export const traits: TraitDefinition[] = [
  {
    id: "nerve",
    name: "Nerve",
    description: "Holding steady when a plan is already going sideways.",
    min: 0,
    max: 10,
    initial: 5,
    color: "#ff6b5e",
    icon: "Flame",
  },
  {
    id: "instinct",
    name: "Instinct",
    description: "Trusting the first read before thinking it to death.",
    min: 0,
    max: 10,
    initial: 5,
    color: "#4ce0b3",
    icon: "Zap",
  },
  {
    id: "charm",
    name: "Charm",
    description: "Talking a room into going along with it.",
    min: 0,
    max: 10,
    initial: 5,
    color: "#ffd166",
    icon: "Heart",
  },
  {
    id: "focus",
    name: "Focus",
    description: "Keeping the signal clear when everything else is noise.",
    min: 0,
    max: 10,
    initial: 5,
    color: "#55e7ff",
    icon: "Target",
  },
  {
    id: "luck",
    name: "Luck",
    description: "The odds bending your way more often than they should.",
    min: 0,
    max: 10,
    initial: 5,
    color: "#b98bff",
    icon: "Clover",
  },
  {
    id: "cunning",
    name: "Cunning",
    description: "Finding the angle nobody else thought to look for.",
    min: 0,
    max: 10,
    initial: 5,
    color: "#7ee787",
    icon: "Eye",
  },
];

export const traitsById: Record<string, TraitDefinition> = Object.fromEntries(
  traits.map((trait) => [trait.id, trait]),
);

export const initialTraits = (): Record<string, number> =>
  Object.fromEntries(traits.map((trait) => [trait.id, trait.initial]));
