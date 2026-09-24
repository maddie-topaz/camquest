import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorldEventDispatcher } from "../dispatch";
import type { CommandOutcome } from "../store";
import { emptySave } from "../reducer";
import type { GameEvent } from "../types";

const press = {
  type: "TERMINAL_PRESSED",
  terminalId: "signal-terminal",
} as const;

const outcome = (applied: GameEvent[]): CommandOutcome => ({
  ok: true,
  save: emptySave("cam"),
  applied,
});

const unlocked = outcome([
  {
    seq: 9,
    key: "k",
    at: "2026-01-01T00:00:00.000Z",
    payload: {
      type: "quest.stepUnlocked",
      slug: "unknown-signal",
      stepId: "registration",
      reason: "t",
    },
  },
]);

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("world event dispatcher", () => {
  it("runs the event through the engine for the configured player", async () => {
    const run = vi.fn(async () => unlocked);
    const dispatch = createWorldEventDispatcher({ run, playerId: "cam" });
    expect(await dispatch(press)).toEqual({
      changed: true,
      quests: ["unknown-signal"],
    });
    expect(run).toHaveBeenCalledWith(press, "cam");
    expect(console.info).toHaveBeenCalledWith(
      "[Game] updated quest unknown-signal",
    );
  });

  it("reports no change when the event changed nothing", async () => {
    const dispatch = createWorldEventDispatcher({
      run: async () => outcome([]),
      playerId: "cam",
    });
    expect(await dispatch(press)).toEqual({ changed: false, quests: [] });
  });

  it("lets a persistence failure propagate", async () => {
    const dispatch = createWorldEventDispatcher({
      run: async () => {
        throw new Error("deadlock");
      },
      playerId: "cam",
    });
    await expect(dispatch(press)).rejects.toThrow("deadlock");
  });
});
