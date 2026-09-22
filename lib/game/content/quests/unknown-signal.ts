import type { QuestDefinition } from "./types";

// The onboarding quest. Mechanically it's still the signal-lock encounter;
// narratively it's the system finding Cam for the first time, confirming
// him as the registered player, and turning up a second heat signature it
// wasn't expecting. Completion is what actually persists that — see
// `rewards` below, applied once via lib/game/commands.ts.
export const unknownSignal: QuestDefinition = {
  id: "unknown-signal",
  slug: "unknown-signal",
  title: "First Contact",
  description: "Something out there is trying to find you.",
  symbol: "📡",
  status: "available",
  introduction:
    "A frequency flickers awake in the dark, not quite sound, not quite light." +
    "\n\nIt isn't searching at random. It's searching for something specific." +
    "\n\nHold the line. Let it find you.",
  ctaLabel: "Answer the signal",
  steps: [
    {
      type: "encounter",
      id: "lock-signal",
      title: "Lock the signal",
      prompt:
        "The frequency won't hold still." +
        "\n\nCatch the needle inside the glow and keep the channel open." +
        "\n\nFive passes. Less room for error each time.",
      encounterId: "signal-lock",
    },
    {
      type: "reveal",
      id: "registration",
      title: "Signal identified",
      prompt:
        "The static drops away." +
        "\n\nFor a moment, the channel is perfectly clear." +
        "\n\nSomewhere behind the signal, something old wakes up and starts writing.",
      message: "PLAYER FOUND — designation CAM — status: ONLINE.",
    },
    {
      type: "reveal",
      id: "companion-detected",
      title: "Second signature",
      prompt:
        "The scan should be finished." +
        "\n\nIt isn't." +
        "\n\nSomething else is still appearing on the readout." +
        "\n\nA second heat signature from something small, close and furry.",
      message: "COMPANION DETECTED — designation KITANA — status: ONLINE.",
    },
  ],
  completionTitle: "Contact established",
  completionMessage:
    "The line goes quiet, but the system doesn't forget a signal once it's locked. You're on the map now both of you.",
  reward: "REGISTRATION COMPLETE. TWO SIGNATURES ADDED TO THE MAP.",
  rewards: {
    xp: 100,
    traits: { mysteryTolerance: 1 },
    playerName: "Cam",
    companion: { id: "kitana", name: "Kitana", species: "cat" },
    unlockSystems: ["archive", "inventory", "profile"],
  },
};
