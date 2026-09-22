// Tendencies: how Cam tends to play, not what he's capable of. Personality
// dials the story can reference for flavor (which line a quest uses, which
// ending reads back to him) but shouldn't gate anything — see
// lib/game/content/traits.ts for the ability dials that do.
//
// `color` is this tendency's one accent everywhere it appears — see
// app/game-ui/colors.ts.

export type TendencyDefinition = {
  id: string;
  name: string;
  description: string;
  min: number;
  max: number;
  initial: number;
  color: string;
  // Name of a lucide icon registered in tendencyIcons (app/game-ui/icons.ts).
  icon: string;
};

export const tendencies: TendencyDefinition[] = [
  {
    id: "chaos",
    name: "Chaos",
    description: "Appetite for plans going sideways.",
    min: 0,
    max: 10,
    initial: 5,
    color: "#ff8a5c",
    icon: "Shuffle",
  },
  {
    id: "curiosity",
    name: "Curiosity",
    description: "Willingness to open the unmarked door.",
    min: 0,
    max: 10,
    initial: 5,
    color: "#6ec6ff",
    icon: "Search",
  },
  {
    id: "mysteryTolerance",
    name: "Mystery tolerance",
    description: "How long the unknown can stay unknown.",
    min: 0,
    max: 10,
    initial: 5,
    color: "#c792ea",
    icon: "CloudFog",
  },
  {
    id: "caution",
    name: "Caution",
    description: "How carefully the fine print gets read first.",
    min: 0,
    max: 10,
    initial: 5,
    color: "#f4c95d",
    icon: "ShieldAlert",
  },
  {
    id: "earlyMorning",
    name: "Early morning",
    description: "Functional before 9am. Allegedly.",
    min: 0,
    max: 10,
    initial: 2,
    color: "#ff9ecb",
    icon: "Sunrise",
  },
];

export const tendenciesById: Record<string, TendencyDefinition> =
  Object.fromEntries(tendencies.map((tendency) => [tendency.id, tendency]));

export const initialTendencies = (): Record<string, number> =>
  Object.fromEntries(tendencies.map((tendency) => [tendency.id, tendency.initial]));
