// The shape of a quest. One quest per file in this directory; the index
// lists them in the order the quest log shows them.
//
import type { Requirements, Rewards } from '../../types'

// `status` is an authoring flag only. 'coming-soon' hides the steps until
// the content is ready; everything else is derived at runtime from the
// save file by lib/game/rules (locked / available / in-progress /
// completed). The old 'locked' and 'completed' values are accepted for
// backwards compatibility but no longer mean anything.
export type QuestFlag = 'available' | 'completed' | 'locked' | 'coming-soon'
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

export type QuestDefinition = {
  id: string; slug: string; title: string; subtitle?: string; description: string; symbol: string; status: QuestFlag
  introduction?: string; ctaLabel?: string; startPasscode?: string; steps: ChallengeStep[]
  completionTitle?: string; completionMessage: string; reward?: string; companionName?: string; funStats?: { label: string; value: string }[]
  // Quest engine hooks. See lib/game/rules for how they are evaluated.
  requirements?: Requirements
  rewards?: Rewards
  // Rewards are granted on every completion rather than only the first.
  repeatable?: boolean
}
