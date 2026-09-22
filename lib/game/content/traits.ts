// Player traits: numeric dials that quests can require and nudge. Quests
// check minimums (`requirements.traits`) and apply deltas
// (`rewards.traits`). Values are clamped to [min, max] by the reducer.

export type TraitDefinition = {
  id: string
  name: string
  description: string
  min: number
  max: number
  initial: number
}

export const traits: TraitDefinition[] = [
  { id: 'chaos', name: 'Chaos', description: 'Appetite for plans going sideways.', min: 0, max: 10, initial: 5 },
  { id: 'curiosity', name: 'Curiosity', description: 'Willingness to open the unmarked door.', min: 0, max: 10, initial: 5 },
  { id: 'mysteryTolerance', name: 'Mystery tolerance', description: 'How long the unknown can stay unknown.', min: 0, max: 10, initial: 5 },
  { id: 'earlyMorning', name: 'Early morning', description: 'Functional before 9am. Allegedly.', min: 0, max: 10, initial: 2 },
]

export const traitsById: Record<string, TraitDefinition> = Object.fromEntries(traits.map((trait) => [trait.id, trait]))

export const initialTraits = (): Record<string, number> =>
  Object.fromEntries(traits.map((trait) => [trait.id, trait.initial]))
