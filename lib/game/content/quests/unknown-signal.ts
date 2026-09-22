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
    "A frequency flickers awake in the dark — not quite sound, not quite light." +
    "\n\nIt isn't searching at random. It's searching for something specific." +
    "\n\nHold the line. Let it find you.",
  ctaLabel: "Answer the signal",
  steps: [
    {
      type: "encounter",
      id: "lock-signal",
      title: "Hold the frequency",
      prompt:
        "The dial drifts, hunting for a lock. Tap when the needle crosses the glow." +
        "\n\nFive passes. The window tightens every time.",
      encounterId: "signal-lock",
    },
    {
      type: "reveal",
      id: "registration",
      title: "Identity confirmed",
      prompt:
        "The static resolves into a single clean tone." +
        "\n\nSomewhere behind the signal, something old wakes up and starts reading.",
      message: "PLAYER FOUND — designation CAM — status: ONLINE.",
    },
    {
      type: "reveal",
      id: "companion-detected",
      title: "Second signature",
      prompt:
        "Before the channel closes, the readout flickers." +
        "\n\nThere's a second heat signature. Small. Close. It's been there the whole time.",
      message: "COMPANION DETECTED — designation KITANA — logging now.",
    },
  ],
  completionTitle: "Contact established",
  completionMessage:
    "The line goes quiet, but the system doesn't forget a signal once it's locked. You're on the map now — both of you.",
  reward: "TWO NAMES ON FILE. THE SYSTEM WAS WAITING FOR BOTH.",
  rewards: {
    xp: 100,
    traits: { mysteryTolerance: 1 },
    playerName: "Cam",
    companion: { id: "kitana", name: "Kitana", species: "cat" },
    unlockSystems: ["archive", "inventory", "profile"],
  },
};
