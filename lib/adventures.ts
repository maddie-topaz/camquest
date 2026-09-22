import type { Requirements, Rewards } from '@/lib/game/types'

// `status` is an authoring flag only. 'coming-soon' hides the steps until
// the content is ready; everything else is derived at runtime from the
// save file by lib/game/rules (locked / available / in-progress /
// completed). The old 'locked' and 'completed' values are accepted for
// backwards compatibility but no longer mean anything.
export type AdventureStatus = 'available' | 'completed' | 'locked' | 'coming-soon'
export type MysteryCard = { label: string; outcome?: string; icon?: string; summaryValue?: string; tags?: string[] }
export type ChallengeStep =
  | { type: 'choice'; id: string; title: string; prompt: string; options: string[]; passcode?: string }
  | { type: 'mystery'; id: string; title: string; prompt: string; cards: MysteryCard[]; concealUntilComplete?: boolean; passcode?: string; summaryLabel?: string }
  | { type: 'riddle'; id: string; title: string; prompt: string; clue: string; answer: string; passcode?: string }
  | { type: 'activity'; id: string; title: string; prompt: string; detail: string; passcode?: string }
  | { type: 'reveal'; id: string; title: string; prompt: string; message: string; passcode?: string }
  | { type: 'confirm'; id: string; title: string; prompt: string; button: string; passcode?: string }
  // A Phaser mini-game. `encounterId` names an entry in
  // lib/game/content/encounters; the step completes when the game reports
  // a result, and the encounter's own rewards are paid at that moment.
  | { type: 'encounter'; id: string; title: string; prompt: string; encounterId: string; passcode?: string }

export type Adventure = {
  id: string; slug: string; title: string; subtitle?: string; description: string; symbol: string; status: AdventureStatus
  introduction?: string; ctaLabel?: string; startPasscode?: string; steps: ChallengeStep[]
  completionTitle?: string; completionMessage: string; reward?: string; companionName?: string; funStats?: { label: string; value: string }[]
  // Quest engine hooks. See lib/game/rules for how they are evaluated.
  requirements?: Requirements
  rewards?: Rewards
  // Rewards are granted on every completion rather than only the first.
  repeatable?: boolean
}

export const adventures: Adventure[] = [
  {
    id: 'cams-gambit',
    slug: 'cams-gambit',
    title: 'Cam\'s Gambit',
    description: 'A game of chance and choice has been set in motion.',
    symbol: '⚡',
    status: 'available',
    introduction: 'Cam, a game of chance and choice has been set in motion.' +
        '\n\nThe moves will be yours. The consequences belong to fate.' +
        '\n\nTrust your Player Two instincts.',
    ctaLabel: 'Press start to begin',
    startPasscode: 'GAMEON',
    steps: [
      {
        type: 'mystery',
        id: 'load-cartridge',
        title: 'Load cartridge',
        // Round passcodes are placeholders — change them to whatever you
        // like. They're listed on the undocumented /reset debug page for
        // quick reference on the day.
        passcode: 'INSERTCOIN',
        summaryLabel: 'Cartridge',
        prompt: 'The mysterious challenger has left two cartridges glowing in the dark.' +
            '\n\nOnly one can begin the game.' +
            '\n\nChoose wisely.',
        concealUntilComplete: true,
        cards: [
          { label: 'Sun Cartridge', outcome: 'Head to Pot Black and settle it over the pool table', icon: 'Sun', summaryValue: 'Sun' },
          { label: 'Moon Cartridge', outcome: 'Head to Planet Royale and battle it out in the arcade', icon: 'Moon', summaryValue: 'Moon' },
        ],
      },
      {
        type: 'mystery',
        id: 'load-map',
        title: 'Choose your guide',
        passcode: 'GUIDESTAR',
        summaryLabel: 'Guide',
        prompt: 'The match ends. Somewhere on the map, a new signal appears.' +
            '\n\nTwo strange creatures appear before you. Both know the way forward, but only one can be followed.' +
            '\n\nChoose your guide.',
        concealUntilComplete: true,
        cards: [
          { label: 'Kitsune', outcome: 'Follow the fox to Goody Two’s', icon: 'Origami' },
          { label: 'Unicorn', outcome: 'Follow the unicorn to Foxtrot Unicorn', icon: 'Sparkles' },
        ],
      },
      {
        type: 'mystery',
        id: 'fate-engine',
        title: 'Activate the Fate Engine',
        passcode: 'WILDCARD',
        summaryLabel: 'Fate',
        prompt: 'You follow your guide to your destination and step inside.' +
            '\n\nA strange machine hums to life. Two symbols glow across its surface: one bound together, the other ruled by chance.' +
            '\n\nChoose your fate.',
        concealUntilComplete: true,
        cards: [
          { label: 'Twin Fate', outcome: 'Choose a cocktail for each other', icon: 'Link', summaryValue: 'Twin' },
          { label: 'Wild Fate', outcome: 'Roll the dice and let chance choose two cocktails', icon: 'Dice5', summaryValue: 'Wild', tags: ['dice-based'] },
        ],
      },
      {
        type: 'reveal',
        id: 'dinner',
        title: 'New objective',
        passcode: 'BBQTIME',
        prompt: 'The Fate Engine falls silent.' +
            '\n\nA single destination begins to pulse on the map.',
        message: 'Proceed to K Town Korean BBQ.',
      },
      {
        type: 'mystery',
        id: 'final-stage',
        title: 'Face the final stage',
        passcode: 'LASTCALL',
        summaryLabel: 'Final stage',
        prompt: 'The feast is over.' +
            '\n\nAt the edge of the map, two final portals pulse into existence.' +
            '\n\nOne glows like a garden beneath glass. The other crackles beneath neon palms.' +
            '\n\nThe challenger has made their final move.' +
            '\n\nNow make yours.',
        concealUntilComplete: true,
        cards: [
          { label: 'Glass Garden', outcome: 'Go for a final drink at Terrarium', icon: 'Martini' },
          { label: 'Neon Jungle', outcome: 'Go for a final drink at Hula Bula Bar', icon: 'Palmtree' },
        ],
      },
    ],
    completionTitle: 'Gambit complete',
    completionMessage: 'The final choice locks into place. The screen goes dark. Then, one message appears:',
    reward: 'YOUR FATE HAS BEEN WRITTEN.',
    companionName: 'Cam',
    funStats: [
      { label: 'Cocktails acquired', value: '2+' },
      { label: 'Player 1 betrayals', value: '???' },
      { label: 'Korean BBQ consumed', value: 'Critical' },
    ],
    rewards: {
      xp: 250,
      traits: { chaos: 1, curiosity: 1 },
      unlocks: ['unknown-signal'],
    },
  },
  {
    // Placeholder for the next quest: shows how prerequisites gate a quest
    // in the log. Flip status to 'available' once the steps are written.
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
    requirements: {
      unlock: true,
      items: ['vip-wristband'],
      questsCompleted: ['cams-gambit'],
    },
    rewards: {
      xp: 100,
      traits: { mysteryTolerance: 1 },
    },
  },
]

export function getAdventure(slug: string) { return adventures.find((adventure) => adventure.slug === slug) }
// Add an adventure to this array. Give it a unique slug, then compose steps using the ChallengeStep union above. Generic screens render every step from its `type`.
// See the Adventure type for every field; no component changes are needed for a new adventure.
// Example: { type: 'confirm', id: 'door', title: 'Open the door', prompt: 'Ready?', button: 'Open it' }
// Progress and completions live in the save file (lib/game); nothing here is persisted.
// Set status to 'coming-soon' until the steps are ready; the rules engine derives everything else.

export const authoringGuide = 'Create a new object in adventures with a unique id and slug, title, description, status, steps, and completionMessage. Each step must include a type and the fields for that type. Add it to the adventures array; the portal, intro, progress, persistence, and completion screens update automatically.'
