import { describe, expect, it, vi } from "vitest";

// No shipped quest uses a world trigger yet, so these tests gate
// Unknown Signal's "registration" step on a terminal press.
vi.mock("../content/quests", async (importOriginal) => {
  const original = await importOriginal<typeof import("../content/quests")>();
  const quests = original.quests.map((quest) =>
    quest.slug !== "unknown-signal"
      ? quest
      : {
          ...quest,
          steps: quest.steps.map((step) =>
            step.id === "registration"
              ? {
                  ...step,
                  trigger: {
                    type: "TERMINAL_PRESSED" as const,
                    terminalId: "signal-terminal",
                  },
                }
              : step,
          ),
        },
  );
  return {
    ...original,
    quests,
    getQuest: (slug: string) => quests.find((quest) => quest.slug === slug),
  };
});
import { createActor } from "xstate";
import { handleCommand, handleWorldEvent } from "../commands";
import { getQuest } from "../content/quests";
import { questMachine, questSelectors } from "../machines/quest";
import { applyEvent } from "../reducer";
import type { GameEvent, GameEventPayload, NewGameEvent } from "../types";
import { completed, created, saveFrom } from "./helpers";

const press = {
  type: "TERMINAL_PRESSED",
  terminalId: "signal-terminal",
} as const;
const started: GameEventPayload = {
  type: "quest.started",
  slug: "unknown-signal",
};

const payloads = (events: NewGameEvent[]) => events.map((e) => e.payload);

describe("handleWorldEvent", () => {
  it("unlocks the triggered step of an in-progress quest", () => {
    const result = handleWorldEvent(saveFrom([created(), started]), press);
    expect(result.ok && payloads(result.events)).toEqual([
      {
        type: "quest.stepUnlocked",
        slug: "unknown-signal",
        stepId: "registration",
        reason: "TERMINAL_PRESSED:signal-terminal",
      },
    ]);
  });

  it("does nothing when no started quest is waiting for it", () => {
    expect(handleWorldEvent(saveFrom([created()]), press)).toEqual({
      ok: true,
      events: [],
    });
    expect(
      handleWorldEvent(
        saveFrom([created(), started, completed("unknown-signal")]),
        press,
      ),
    ).toEqual({ ok: true, events: [] });
  });

  it("does nothing for a different terminal or event type", () => {
    const save = saveFrom([created(), started]);
    expect(
      handleWorldEvent(save, { type: "TERMINAL_PRESSED", terminalId: "other" }),
    ).toEqual({ ok: true, events: [] });
    expect(
      handleWorldEvent(save, {
        type: "BEACON_ACTIVATED",
        beaconId: "signal-terminal",
      }),
    ).toEqual({ ok: true, events: [] });
  });

  it("is idempotent: a second press after the unlock is a no-op", () => {
    const save = saveFrom([
      created(),
      started,
      {
        type: "quest.stepUnlocked",
        slug: "unknown-signal",
        stepId: "registration",
        reason: "t",
      },
    ]);
    expect(save.quests["unknown-signal"].unlockedSteps).toEqual([
      "registration",
    ]);
    expect(handleWorldEvent(save, press)).toEqual({ ok: true, events: [] });
  });
});

describe("quest.progress keeps trigger unlocks", () => {
  it("doesn't let a client that hasn't heard yet clobber a terminal unlock", () => {
    const save = saveFrom([
      created(),
      started,
      {
        type: "quest.stepUnlocked",
        slug: "unknown-signal",
        stepId: "registration",
        reason: "t",
      },
    ]);
    const result = handleCommand(save, {
      type: "quest.progress",
      slug: "unknown-signal",
      step: 1,
      answers: { "lock-signal": "5" },
      unlockedSteps: [],
    });
    expect(result.ok && result.events[0].payload).toMatchObject({
      type: "quest.progressed",
      unlockedSteps: ["registration"],
    });
  });
});

describe("questMachine with a terminal-gated step", () => {
  const quest = getQuest("unknown-signal")!;
  const start = () => {
    const save = saveFrom([created(), started]);
    const actor = createActor(questMachine, {
      input: {
        quest,
        save,
        saved: {
          step: 1,
          answers: { "lock-signal": "5" },
          unlockedSteps: [],
          completions: 0,
        },
        completed: false,
      },
    });
    actor.start();
    return actor;
  };

  it("waits at the checkpoint, and an empty passcode can't open it", () => {
    const actor = start();
    expect(questSelectors.isGated(actor.getSnapshot())).toBe(true);
    actor.send({ type: "SUBMIT_PASSCODE" });
    expect(questSelectors.isGated(actor.getSnapshot())).toBe(true);
  });

  it("opens when the server reports the unlock", () => {
    const actor = start();
    actor.send({ type: "SYNC_UNLOCKS", unlockedSteps: [] });
    expect(questSelectors.isGated(actor.getSnapshot())).toBe(true);
    actor.send({ type: "SYNC_UNLOCKS", unlockedSteps: ["registration"] });
    expect(actor.getSnapshot().matches({ step: { open: "choosing" } })).toBe(
      true,
    );
    expect(actor.getSnapshot().context.unlockedSteps).toEqual(["registration"]);
  });
});

describe("reducer: quest.stepUnlocked", () => {
  it("adds the step once", () => {
    const save = saveFrom([created(), started]);
    const event = (seq: number): GameEvent => ({
      seq,
      key: `u${seq}`,
      at: "2026-01-02T00:00:00.000Z",
      payload: {
        type: "quest.stepUnlocked",
        slug: "unknown-signal",
        stepId: "registration",
        reason: "t",
      },
    });
    const next = applyEvent(applyEvent(save, event(3)), event(4));
    expect(next.quests["unknown-signal"].unlockedSteps).toEqual([
      "registration",
    ]);
  });
});
