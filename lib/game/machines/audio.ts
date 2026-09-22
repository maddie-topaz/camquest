// The audio layer as a machine. Browsers refuse to play sound until the
// page has had a user gesture, so cues that arrive before then are
// dropped rather than queued (a burst of stale blips on first click would
// be worse than silence). The player is injected: Howler in the app, a
// recorder in tests.
//
//   locked  → (UNLOCK, from a user gesture) → ready
//   ready   ⇄ muted            CUE plays only in ready

import { assign, setup } from "xstate";

export type AudioPlayer = {
  play: (cue: string, detail?: Record<string, unknown>) => void;
  setVolume: (volume: number) => void;
  // Resumes the browser audio context. Resolves false if still blocked.
  unlock: () => Promise<boolean>;
};

export type AudioMachineInput = {
  player: AudioPlayer;
  volume?: number;
  muted?: boolean;
};

export type AudioContext = {
  player: AudioPlayer;
  volume: number;
  muted: boolean;
};

export type AudioEvent =
  | { type: "CUE"; cue: string; detail?: Record<string, unknown> }
  | { type: "UNLOCK" }
  | { type: "UNLOCKED" }
  | { type: "TOGGLE_MUTE" }
  | { type: "SET_VOLUME"; volume: number };

export const audioMachine = setup({
  types: {
    context: {} as AudioContext,
    events: {} as AudioEvent,
    input: {} as AudioMachineInput,
  },
  guards: {
    startsMuted: ({ context }) => context.muted,
  },
  actions: {
    play: ({ context, event }) => {
      if (event.type === "CUE") context.player.play(event.cue, event.detail);
    },
    applyVolume: ({ context }) =>
      context.player.setVolume(context.muted ? 0 : context.volume),
    toggleMute: assign({ muted: ({ context }) => !context.muted }),
    setVolume: assign({
      volume: ({ event }) =>
        event.type === "SET_VOLUME"
          ? Math.min(1, Math.max(0, event.volume))
          : 0.8,
    }),
  },
}).createMachine({
  id: "audio",
  context: ({ input }) => ({
    player: input.player,
    volume: input.volume ?? 0.8,
    muted: input.muted ?? false,
  }),
  initial: "locked",
  entry: "applyVolume",
  on: {
    SET_VOLUME: { actions: ["setVolume", "applyVolume"] },
  },
  states: {
    locked: {
      on: {
        UNLOCKED: [
          { guard: "startsMuted", target: "muted" },
          { target: "ready" },
        ],
        // Mute can be toggled before audio is unlocked; it just changes
        // where UNLOCKED lands.
        TOGGLE_MUTE: { actions: ["toggleMute", "applyVolume"] },
      },
    },
    ready: {
      on: {
        CUE: { actions: "play" },
        TOGGLE_MUTE: {
          target: "muted",
          actions: ["toggleMute", "applyVolume"],
        },
      },
    },
    muted: {
      on: {
        TOGGLE_MUTE: {
          target: "ready",
          actions: ["toggleMute", "applyVolume"],
        },
      },
    },
  },
});
