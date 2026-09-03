export type AdventureStatus = 'available' | 'completed' | 'locked' | 'coming-soon'
export type MysteryCard = { label: string; outcome?: string; icon?: string }
export type ChallengeStep =
  | { type: 'choice'; id: string; title: string; prompt: string; options: string[] }
  | { type: 'mystery'; id: string; title: string; prompt: string; cards: MysteryCard[]; concealUntilComplete?: boolean }
  | { type: 'riddle'; id: string; title: string; prompt: string; clue: string; answer: string }
  | { type: 'activity'; id: string; title: string; prompt: string; detail: string }
  | { type: 'reveal'; id: string; title: string; prompt: string; message: string }
  | { type: 'confirm'; id: string; title: string; prompt: string; button: string }

export type Adventure = { id: string; slug: string; title: string; subtitle: string; description: string; symbol: string; status: AdventureStatus; duration: string; tags: string[]; introduction?: string; steps: ChallengeStep[]; completionMessage: string; reward?: string }
export type AdventureProgress = { step: number; completed: boolean; answers?: Record<string, string> }

export const siteConfig = { name: 'Welcome, Cam', eyebrow: 'A private atlas for two', intro: 'A little portal for the dares, detours, and tiny legends we make together.', companion: 'Cam' }
const progressStorageKey = 'camquest-progress-v2'

export const adventures: Adventure[] = [
  {
    id: 'cams-gambit',
    slug: 'cams-gambit',
    title: 'Cam\'s Gambit',
    subtitle: 'Choose carefully.',
    description: 'Something has been loaded into the system.',
    symbol: '⚡',
    status: 'available',
    duration: '2–3 min',
    tags: ['Saturday quest', '4 hidden choices'],
    introduction: 'Cam, Saturday is waiting for you. Only four questions stand between you and your final fate. Trust your player two instincts.',
    steps: [
      {
        type: 'mystery',
        id: 'opening-move',
        title: 'Choose the opening move',
        prompt: 'Two save files. One decides how our Saturday begins. Pick the one calling to you.',
        concealUntilComplete: true,
        cards: [
          { label: 'Sun Cartridge', outcome: 'A relaxed breakfast at a cosy café', icon: 'Sun' },
          { label: 'Moon Cartridge', outcome: 'Takeaway coffee and breakfast by the water', icon: 'Moon' },
        ],
      },
      {
        type: 'mystery',
        id: 'main-quest',
        title: 'Select the main quest',
        prompt: 'The map has split into two unknown regions. Choose where we load in.',
        concealUntilComplete: true,
        cards: [
          { label: 'Wild Path', outcome: 'A garden or trail made for wandering', icon: 'TreePine' },
          { label: 'Secret Door', outcome: 'An indoor spot with something new to discover', icon: 'DoorOpen' },
        ],
      },
      {
        type: 'mystery',
        id: 'bonus-level',
        title: 'Unlock the bonus level',
        prompt: 'Every great campaign needs a side quest. Which token gets the slot?',
        concealUntilComplete: true,
        cards: [
          { label: 'High Score', outcome: 'A playful stop for games and friendly competition', icon: 'Trophy' },
          { label: 'Bonus Round', outcome: 'A creative stop with something worth exploring together', icon: 'Gift' },
        ],
      },
      {
        type: 'mystery',
        id: 'final-stage',
        title: 'Pick the final stage',
        prompt: 'The map has split into two unknown regions. Choose where we go next.',
        concealUntilComplete: true,
        cards: [
          { label: 'Glass Garden', outcome: 'Go for a drink at Terrarium', icon: 'Martini' },
          { label: 'Neon Jungle', outcome: 'Go for a drink at Hula Bula Bar', icon: 'Palmtree' },
        ],
      },
    ],
    completionMessage: 'Quest complete. Here is what your choices unlocked:',
    reward: 'ALL CHOICES LOCKED IN',
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

export const authoringGuide = 'Create a new object in adventures with a unique id and slug, title, description, status, duration, tags, steps, and completionMessage. Each step must include a type and the fields for that type. Add it to the adventures array; the portal, intro, progress, persistence, and completion screens update automatically.'
