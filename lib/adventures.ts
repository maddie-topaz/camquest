export type AdventureStatus = 'available' | 'completed' | 'locked' | 'coming-soon'
export type ChallengeStep =
  | { type: 'choice'; id: string; title: string; prompt: string; options: string[] }
  | { type: 'mystery'; id: string; title: string; prompt: string; cards: { label: string; reveal: string }[] }
  | { type: 'riddle'; id: string; title: string; prompt: string; clue: string; answer: string }
  | { type: 'activity'; id: string; title: string; prompt: string; detail: string }
  | { type: 'reveal'; id: string; title: string; prompt: string; message: string }
  | { type: 'confirm'; id: string; title: string; prompt: string; button: string }

export type Adventure = { id: string; slug: string; title: string; subtitle: string; description: string; symbol: string; status: AdventureStatus; duration: string; tags: string[]; introduction?: string; steps: ChallengeStep[]; completionMessage: string; reward?: string }

export const siteConfig = { name: 'Our Shared Lore', eyebrow: 'A private atlas for two', intro: 'A little portal for the dares, detours, and tiny legends we make together.', companion: 'Cam' }

export const adventures: Adventure[] = [
  { id: 'moonlit', slug: 'moonlit-detour', title: 'The Moonlit Detour', subtitle: 'A pocket-sized quest for an ordinary evening', description: 'Follow the thread of small choices until it leads somewhere neither of you expected.', symbol: '✦', status: 'available', duration: '10–15 min', tags: ['Quick quest', 'For tonight'], introduction: 'Cam, the map is warm to the touch. It seems to know you are here. There are four small gates between this moment and a secret waiting at the end.', steps: [
    { type: 'choice', id: 'choose', title: 'The first fork', prompt: 'The path splits under a violet moon. Which feeling should guide the quest?', options: ['Curiosity', 'Courage', 'Mischief'] },
    { type: 'mystery', id: 'cards', title: 'Two sealed envelopes', prompt: 'One holds a tiny adventure. One holds a tiny reward. Choose by instinct.', cards: [{ label: 'The left-hand star', reveal: 'A walk somewhere neither of you has visited together.' }, { label: 'The right-hand star', reveal: 'Your companion owes you a dessert of your choosing.' }] },
    { type: 'riddle', id: 'riddle', title: 'A clue in the margins', prompt: 'Solve the little riddle to reveal the final gate.', clue: 'I have a face but no eyes, hands but no arms. I keep what you give me, but never hold it.', answer: 'clock' },
    { type: 'reveal', id: 'reveal', title: 'The map unfolds', prompt: 'You made it this far. Here is what the stars were pointing toward:', message: 'Tonight: phones away, shoes on, and a spontaneous walk until you find a light you want to follow.' },
  ], completionMessage: 'Quest complete. The best adventures are the ones that become stories before they are finished.', reward: 'A golden little detour' },
  { id: 'summer', slug: 'summer-constellation', title: 'Summer Constellation', subtitle: 'A longer orbit is forming', description: 'A warm-weather constellation of clues, snacks, and one destination worth keeping secret.', symbol: '◒', status: 'coming-soon', duration: '30–45 min', tags: ['Coming soon', 'Field notes'], steps: [], completionMessage: '' },
]

export function getAdventure(slug: string) { return adventures.find((adventure) => adventure.slug === slug) }
export function getProgress() { if (typeof window === 'undefined') return {}; try { return JSON.parse(localStorage.getItem('shared-lore-progress') || '{}') } catch { return {} } }
export function saveProgress(slug: string, step: number, completed = false) { const progress = getProgress(); progress[slug] = { step, completed }; localStorage.setItem('shared-lore-progress', JSON.stringify(progress)) }
export function resetProgress() { localStorage.removeItem('shared-lore-progress') }

// Add an adventure to this array. Give it a unique slug, then compose steps using the ChallengeStep union above. Generic screens render every step from its `type`.
// See the Adventure type for every field; no component changes are needed for a new adventure.
// Example: { type: 'confirm', id: 'door', title: 'Open the door', prompt: 'Ready?', button: 'Open it' }
// Future authoring guide: keep copy and answers here, use an asset path in your own visual treatment, and set status to 'coming-soon' until ready.

export const authoringGuide = 'Create a new object in adventures with a unique id and slug, title, description, status, duration, tags, steps, and completionMessage. Each step must include a type and the fields for that type. Add it to the adventures array; the portal, intro, progress, persistence, and completion screens update automatically.'
