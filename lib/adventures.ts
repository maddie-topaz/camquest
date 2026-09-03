export type AdventureStatus = 'available' | 'completed' | 'locked' | 'coming-soon'
export type MysteryCard = { label: string; outcome?: string; icon?: string; reveal?: string }
export type ChallengeStep =
  | { type: 'choice'; id: string; title: string; prompt: string; options: string[] }
  | { type: 'mystery'; id: string; title: string; prompt: string; cards: MysteryCard[]; concealUntilComplete?: boolean }
  | { type: 'riddle'; id: string; title: string; prompt: string; clue: string; answer: string }
  | { type: 'activity'; id: string; title: string; prompt: string; detail: string }
  | { type: 'reveal'; id: string; title: string; prompt: string; message: string }
  | { type: 'confirm'; id: string; title: string; prompt: string; button: string }

export type Adventure = { id: string; slug: string; title: string; subtitle?: string; description: string; symbol: string; status: AdventureStatus; introduction?: string; ctaLabel?: string; steps: ChallengeStep[]; completionTitle?: string; completionMessage: string; reward?: string }
export type AdventureProgress = { step: number; completed: boolean; answers?: Record<string, string> }

export const siteConfig = { name: 'Welcome, to Cam⚡Quest', eyebrow: 'Ready Player 2', intro: 'Adventure awaits.', companion: 'Cam' }
const progressStorageKey = 'camquest-progress-v2'

export const adventures: Adventure[] = [
  {
    id: 'cams-gambit',
    slug: 'cams-gambit',
    title: 'Cam\'s Gambit',
    description: 'Something has been loaded into the system.',
    symbol: '⚡',
    status: 'available',
    introduction: 'Cam, a game of chance and choice has been set in motion.' +
        '\n\nThe moves will be yours. The consequences belong to fate.' +
        '\n\nTrust your Player Two instincts.',
    ctaLabel: 'Press start to begin',
    steps: [
      {
        type: 'mystery',
        id: 'opening-move',
        title: 'Opening move',
        prompt: 'The mysterious challenger has left two cartridges glowing in the dark. One bears the sun. The other, the moon.\n\nOnly one can begin the game.\n\nMake your opening move.',
        concealUntilComplete: true,
        cards: [
          { label: 'Sun Cartridge', reveal: 'The Sun Cartridge flickers to life.', outcome: 'A relaxed breakfast at a cosy café', icon: 'Sun' },
          { label: 'Moon Cartridge', reveal: 'The Moon Cartridge locks into place.', outcome: 'Takeaway coffee and breakfast by the water', icon: 'Moon' },
        ],
      },
      {
        type: 'mystery',
        id: 'main-quest',
        title: 'Choose your path',
        prompt: 'The cartridge loads. The screen flashes, and a new world begins to form.\n\nAhead, the route divides. One path runs wild beneath the open sky. The other disappears behind a secret door.\n\nWhich path is calling you?',
        concealUntilComplete: true,
        cards: [
          { label: 'Wild Path', reveal: 'The wild route has claimed you.', outcome: 'A garden or trail made for wandering', icon: 'TreePine' },
          { label: 'Secret Door', reveal: 'The hidden passage opens.', outcome: 'An indoor spot with something new to discover', icon: 'DoorOpen' },
        ],
      },
      {
        type: 'mystery',
        id: 'bonus-level',
        title: 'Unlock the bonus level',
        prompt: 'You press onward—but a strange signal cuts through the static.\n\nA hidden level has appeared. The challenger has left two tokens behind, but only one can unlock what waits inside.\n\nChoose your token.',
        concealUntilComplete: true,
        cards: [
          { label: 'High Score', reveal: 'Challenge mode activated.', outcome: 'A playful stop for games and friendly competition', icon: 'Trophy' },
          { label: 'Bonus Round', reveal: 'A rare encounter has appeared.', outcome: 'A creative stop with something worth exploring together', icon: 'Gift' },
        ],
      },
      {
        type: 'mystery',
        id: 'final-stage',
        title: 'Face the final stage',
        prompt: 'The static clears. At the edge of the map, two portals pulse into existence.\n\nOne glows like a garden beneath glass. The other crackles beneath neon palms.\n\nThe challenger has made their final move.\n\nNow make yours.',
        concealUntilComplete: true,
        cards: [
          { label: 'Glass Garden', reveal: 'The Glass Garden awaits.', outcome: 'Go for a drink at Terrarium', icon: 'Martini' },
          { label: 'Neon Jungle', reveal: 'The Neon Jungle calls.', outcome: 'Go for a drink at Hula Bula Bar', icon: 'Palmtree' },
        ],
      },
    ],
    completionTitle: 'Gambit complete.',
    completionMessage: 'The final choice locks into place. The screen goes dark. Then, one message appears:',
    reward: 'YOUR FATE HAS BEEN WRITTEN.',
  },
]

export function getAdventure(slug: string) { return adventures.find((adventure) => adventure.slug === slug) }
export function getProgress(): Record<string, AdventureProgress> { if (typeof window === 'undefined') return {}; try { return JSON.parse(localStorage.getItem(progressStorageKey) || '{}') } catch { return {} } }
export function saveProgress(slug: string, step: number, completed = false, answers?: Record<string, string>) { const progress = getProgress(); const current = progress[slug]; progress[slug] = { step, completed, answers: answers ?? current?.answers }; localStorage.setItem(progressStorageKey, JSON.stringify(progress)) }
export function resetAdventureProgress(slug: string) { const progress = getProgress(); delete progress[slug]; localStorage.setItem(progressStorageKey, JSON.stringify(progress)) }

// Add an adventure to this array. Give it a unique slug, then compose steps using the ChallengeStep union above. Generic screens render every step from its `type`.
// See the Adventure type for every field; no component changes are needed for a new adventure.
// Example: { type: 'confirm', id: 'door', title: 'Open the door', prompt: 'Ready?', button: 'Open it' }
// Future authoring guide: keep copy and answers here, use an asset path in your own visual treatment, and set status to 'coming-soon' until ready.

export const authoringGuide = 'Create a new object in adventures with a unique id and slug, title, description, status, steps, and completionMessage. Each step must include a type and the fields for that type. Add it to the adventures array; the portal, intro, progress, persistence, and completion screens update automatically.'
