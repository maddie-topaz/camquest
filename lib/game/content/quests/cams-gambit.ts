import type { QuestDefinition } from './types'

export const camsGambit: QuestDefinition = {
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
  // The Gambit only opens once the signal has been locked.
  requirements: {
    questsCompleted: ['unknown-signal'],
  },
  rewards: {
    xp: 250,
    traits: { chaos: 1, curiosity: 1 },
  },
}
