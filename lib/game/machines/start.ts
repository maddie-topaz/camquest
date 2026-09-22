// The START button ceremony. Boots, loads the save, and either skips
// straight into the game or reveals whatever grants are waiting to be
// accepted. Sound cues and the final navigation are emitted, never
// performed, so the machine runs identically in tests and in the cabinet.
//
//   idle → booting → (nothing pending) skipped
//                  → revealing → ready → accepting → accepted
//                  → error → RETRY → booting

import { assign, emit, fromPromise, setup } from "xstate";
import type { PendingGrantView, SaveView } from "../view";

// One card per item, quantities summed, so gifting the same thing twice
// shows "×2" rather than twins.
export type RevealItem = PendingGrantView & {
  grantKeys: string[];
  reasons: string[];
};

export const groupPendingGrants = (
  pending: PendingGrantView[],
): RevealItem[] => {
  const byItem = new Map<string, RevealItem>();
  for (const grant of pending) {
    const existing = byItem.get(grant.itemId);
    if (existing) {
      existing.quantity += grant.quantity;
      existing.grantKeys.push(grant.key);
      existing.reasons.push(grant.reason);
    } else {
      byItem.set(grant.itemId, {
        ...grant,
        grantKeys: [grant.key],
        reasons: [grant.reason],
      });
    }
  }
  return [...byItem.values()];
};

export type StartMachineInput = {
  load: () => Promise<SaveView>;
  accept: (grantKeys: string[]) => Promise<unknown>;
  // The boot animation's minimum length; the reveal never appears before
  // it has played, even when the save is already cached.
  minBootMs?: number;
};

export type StartContext = {
  items: RevealItem[];
  minBootMs: number;
  load: StartMachineInput["load"];
  accept: StartMachineInput["accept"];
};

export type StartEvent =
  { type: "START" } | { type: "ACCEPT" } | { type: "RETRY" };

export type StartEmitted =
  | { type: "cue"; cue: string; detail?: Record<string, unknown> }
  | { type: "enter" };

// Timings shared with the CSS reveal animation in globals.css.
export const REVEAL_ITEM_DELAY_MS = 650;
export const REVEAL_FIRST_ITEM_MS = 900;
export const REVEAL_READY_BASE_MS = 1250;

export const startMachine = setup({
  types: {
    context: {} as StartContext,
    events: {} as StartEvent,
    input: {} as StartMachineInput,
    emitted: {} as StartEmitted,
  },
  actors: {
    boot: fromPromise(
      async ({
        input,
      }: {
        input: { load: () => Promise<SaveView>; minBootMs: number };
      }) => {
        const [view] = await Promise.all([
          input.load(),
          new Promise((resolve) => setTimeout(resolve, input.minBootMs)),
        ]);
        return view;
      },
    ),
    accept: fromPromise(
      async ({
        input,
      }: {
        input: {
          accept: (keys: string[]) => Promise<unknown>;
          grantKeys: string[];
        };
      }) => {
        await input.accept(input.grantKeys);
      },
    ),
  },
  guards: {
    nothingPending: ({ context }) => context.items.length === 0,
  },
  delays: {
    // Waits for the last card's flourish before enabling Accept.
    revealReady: ({ context }) =>
      REVEAL_READY_BASE_MS + context.items.length * REVEAL_ITEM_DELAY_MS,
  },
  actions: {
    cue: emit(
      (_, params: { cue: string; detail?: Record<string, unknown> }) => ({
        type: "cue" as const,
        cue: params.cue,
        detail: params.detail,
      }),
    ),
    enter: emit({ type: "enter" as const }),
  },
}).createMachine({
  id: "start",
  context: ({ input }) => ({
    items: [],
    minBootMs: input.minBootMs ?? 850,
    load: input.load,
    accept: input.accept,
  }),
  initial: "idle",
  states: {
    idle: {
      on: { START: "booting" },
    },
    booting: {
      entry: { type: "cue", params: { cue: "game-start" } },
      invoke: {
        src: "boot",
        input: ({ context }) => ({
          load: context.load,
          minBootMs: context.minBootMs,
        }),
        onDone: {
          actions: assign({
            items: ({ event }) =>
              groupPendingGrants(event.output.pendingGrants),
          }),
          target: "deciding",
        },
        onError: {
          target: "error",
          actions: { type: "cue", params: { cue: "inventory-error" } },
        },
      },
    },
    deciding: {
      always: [
        { guard: "nothingPending", target: "skipped" },
        { target: "revealing" },
      ],
    },
    revealing: {
      entry: { type: "cue", params: { cue: "inventory-open" } },
      after: {
        revealReady: {
          target: "ready",
          actions: { type: "cue", params: { cue: "inventory-ready" } },
        },
      },
    },
    ready: {
      on: { ACCEPT: "accepting" },
    },
    accepting: {
      invoke: {
        src: "accept",
        input: ({ context }) => ({
          accept: context.accept,
          grantKeys: context.items.flatMap((item) => item.grantKeys),
        }),
        onDone: {
          target: "accepted",
          actions: { type: "cue", params: { cue: "inventory-accepted" } },
        },
        // Nothing was lost: the grants are still pending server-side, so
        // leave the reveal up for another go.
        onError: {
          target: "ready",
          actions: { type: "cue", params: { cue: "inventory-error" } },
        },
      },
    },
    error: {
      on: { RETRY: "booting" },
    },
    skipped: { type: "final", entry: "enter" },
    accepted: { type: "final", entry: "enter" },
  },
});

export const startSelectors = {
  // The reveal copy differs for the first-ever pack versus a later gift.
  isFirstGrant: (items: RevealItem[]) =>
    items.length > 0 &&
    items.every((item) =>
      item.reasons.every((reason) => reason === "starter_loadout"),
    ),
};
