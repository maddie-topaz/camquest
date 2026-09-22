import type { QuestDefinition } from './types'

export const unknownSignal: QuestDefinition = {
  // Placeholder copy: the encounter is real, the transmission text isn't yet.
  id: 'unknown-signal',
  slug: 'unknown-signal',
  title: 'Unknown Signal',
  description: 'Something is broadcasting after dark.',
  symbol: '📡',
  status: 'available',
  introduction: 'A carrier wave, faint but steady, cuts through the static.' +
      '\n\nSomeone is broadcasting. The wristband hums in reply.' +
      '\n\nLock the signal before it drifts.',
  ctaLabel: 'Tune in',
  steps: [
    {
      type: 'encounter',
      id: 'lock-signal',
      title: 'Lock the signal',
      prompt: 'The dial sweeps. Tap when the needle crosses the glow.' +
          '\n\nFive sweeps. The window narrows each time.',
      encounterId: 'signal-lock',
    },
    {
      type: 'reveal',
      id: 'decoded',
      title: 'Signal decoded',
      prompt: 'The static clears.',
      message: 'A voice, a place, a time. Placeholder copy: replace with the real transmission.',
    },
  ],
  completionTitle: 'Signal locked',
  completionMessage: 'The broadcast ends. Whatever it was, it was meant for you.',
  rewards: {
    xp: 100,
    traits: { mysteryTolerance: 1 },
  },
}
