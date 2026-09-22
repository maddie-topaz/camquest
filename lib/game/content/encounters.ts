import type { Rewards } from '../types'

// Mini-games. Each maps to a Phaser scene module in lib/game/encounters
// (loaded only when the encounter mounts) and decides what a result is
// worth. Rewards are evaluated on the server from the reported score.

export type EncounterResult = { score: number; reward?: string }

export type EncounterDefinition = {
  id: string
  name: string
  description: string
  // Score the scene reports at its best; used for display and normalising.
  maxScore: number
  // Rewards for a result. First clear only unless `repeatableRewards`.
  rewards: (result: EncounterResult) => Rewards
  repeatableRewards?: boolean
  // Optional ranking copy for the result card.
  rank?: (result: EncounterResult) => string
}

export const encounters: EncounterDefinition[] = [
  {
    id: 'signal-lock',
    name: 'Signal Lock',
    description: 'Stop the needle inside the glow. Five sweeps, shrinking window.',
    maxScore: 500,
    rewards: ({ score }) => ({
      xp: 50 + Math.round(score / 5),
      items: score >= 300 ? [{ itemId: 'golden-key' }] : [],
      traits: score >= 450 ? { mysteryTolerance: 1 } : undefined,
    }),
    rank: ({ score }) => (score >= 450 ? 'Perfect lock' : score >= 300 ? 'Clean lock' : score >= 150 ? 'Partial lock' : 'Static'),
  },
]

export const encountersById: Record<string, EncounterDefinition> = Object.fromEntries(encounters.map((e) => [e.id, e]))

export const getEncounter = (id: string) => encountersById[id]
