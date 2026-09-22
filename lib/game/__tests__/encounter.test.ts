import { describe, expect, it, vi } from "vitest";
import { createActor, fromPromise } from "xstate";
import { handleCommand } from "../commands";
import { getQuest } from "../content/quests";
import { encounterMachine, type EncounterRuntime } from "../machines/encounter";
import { questMachine, questSelectors } from "../machines/quest";
import { applyEvent, normaliseSave } from "../reducer";
import type { GameEvent, NewGameEvent, SaveFile } from "../types";
import { completed, created, granted, saveFrom } from "./helpers";

const commit = (save: SaveFile, events: NewGameEvent[]) =>
  events.reduce(
    (state, event, index) =>
      applyEvent(state, {
        seq: state.seq + 1,
        key: event.key ?? `k:${state.seq + index}`,
        at: "2026-03-01T00:00:00.000Z",
        payload: event.payload,
      } as GameEvent),
    save,
  );

// Unknown Signal is the opener: a fresh save can play it.
const readySave = () => saveFrom([created(), granted("vip-wristband")]);

describe("reducer: encounter.completed", () => {
  it("keeps plays, best and last per encounter", () => {
    const save = saveFrom([
      created(),
      {
        type: "encounter.completed",
        encounterId: "signal-lock",
        questSlug: "unknown-signal",
        stepId: "lock-signal",
        score: 210,
      },
      {
        type: "encounter.completed",
        encounterId: "signal-lock",
        questSlug: "unknown-signal",
        stepId: "lock-signal",
        score: 120,
      },
    ]);
    expect(save.player.encounters["signal-lock"]).toMatchObject({
      plays: 2,
      bestScore: 210,
      lastScore: 120,
    });
  });

  it("normalises a snapshot written before encounters existed", () => {
    const old = saveFrom([created()]);
    const { encounters: _dropped, ...legacyPlayer } = old.player;
    const legacy = { ...old, player: legacyPlayer } as unknown as SaveFile;
    expect(normaliseSave(legacy).player.encounters).toEqual({});
  });
});

describe("command: encounter.complete", () => {
  it("records the result and pays score-based rewards once", () => {
    const save = readySave();
    const command = {
      type: "encounter.complete" as const,
      questSlug: "unknown-signal",
      stepId: "lock-signal",
      encounterId: "signal-lock",
      score: 320,
      operationId: "op-1",
    };
    const result = handleCommand(save, command);
    if (!result.ok) throw new Error(result.rejection.message);
    const types = result.events.map((e) => e.payload.type);
    expect(types).toEqual(
      expect.arrayContaining([
        "encounter.completed",
        "xp.gained",
        "item.granted",
      ]),
    );
    expect(result.events[0].key).toBe("encounter:op-1");
    const next = commit(save, result.events);
    expect(next.player.xp).toBe(50 + 64);
    expect(next.player.inventory["golden-key"].quantity).toBe(1);

    // A second, better run adds a play but the first-clear rewards are keyed and spent.
    const again = handleCommand(next, {
      ...command,
      score: 480,
      operationId: "op-2",
    });
    if (!again.ok) throw new Error(again.rejection.message);
    const keys = again.events.map((e) => e.key);
    expect(keys).toContain("encounter:unknown-signal:lock-signal:xp");
    expect(
      commit(next, again.events).player.inventory["golden-key"].quantity,
    ).toBe(1);
  });

  it("rejects bad steps, scores, and locked quests", () => {
    const save = readySave();
    const base = {
      type: "encounter.complete" as const,
      questSlug: "unknown-signal",
      stepId: "lock-signal",
      encounterId: "signal-lock",
      score: 100,
      operationId: "op",
    };
    expect(handleCommand(save, { ...base, stepId: "decoded" })).toMatchObject({
      ok: false,
      rejection: { code: "bad-step" },
    });
    expect(handleCommand(save, { ...base, score: 9999 })).toMatchObject({
      ok: false,
      rejection: { code: "bad-score" },
    });
    expect(
      handleCommand(saveFrom([created()]), {
        ...base,
        questSlug: "cams-gambit",
        stepId: "load-cartridge",
      }),
    ).toMatchObject({ ok: false, rejection: { code: "locked" } });
  });
});

describe("questMachine: encounter step", () => {
  it("hides the button until the game reports, then turns the step over with the score", () => {
    const quest = getQuest("unknown-signal")!;
    const actor = createActor(questMachine, {
      input: { quest, save: readySave(), completed: false },
    }).start();
    const snap = () => actor.getSnapshot();
    expect(questSelectors.step(snap())?.type).toBe("encounter");
    expect(questSelectors.showsPrimary(snap())).toBe(false);
    actor.send({ type: "ENCOUNTER_RESULT", score: 350 });
    expect(questSelectors.isRevealed(snap())).toBe(true);
    expect(questSelectors.showsPrimary(snap())).toBe(true);
    expect(snap().context.answers["lock-signal"]).toBe("350");
    actor.send({ type: "NEXT" });
    expect(snap().context.stepIndex).toBe(1);
  });

  it("restores a played encounter as already revealed", () => {
    const quest = getQuest("unknown-signal")!;
    const actor = createActor(questMachine, {
      input: {
        quest,
        save: readySave(),
        completed: false,
        saved: {
          step: 0,
          answers: { "lock-signal": "200" },
          unlockedSteps: [],
          completions: 0,
        },
      },
    }).start();
    expect(questSelectors.isRevealed(actor.getSnapshot())).toBe(true);
  });
});

describe("encounterMachine", () => {
  const settle = () => new Promise((resolve) => setTimeout(resolve, 5));
  const container = {} as HTMLElement;

  it("loads the runtime, mounts it, emits the result once, and unmounts", async () => {
    const unmount = vi.fn();
    let report: ((r: { score: number }) => void) | null = null;
    const runtime: EncounterRuntime = {
      mount: (_el, onComplete) => {
        report = onComplete;
        return unmount;
      },
    };
    const load = vi.fn(async () => runtime);
    const results: number[] = [];
    const actor = createActor(encounterMachine, {
      input: {
        encounterId: "signal-lock",
        getContainer: () => container,
        load,
      },
    });
    actor.on("result", (e) => results.push(e.result.score));
    actor.start();
    await settle();
    expect(actor.getSnapshot().matches("playing")).toBe(true);
    expect(load).toHaveBeenCalledWith("signal-lock");
    report!({ score: 410 });
    await settle();
    expect(results).toEqual([410]);
    expect(actor.getSnapshot().status).toBe("done");
    expect(unmount).toHaveBeenCalledTimes(1);
  });

  it("fails without a container or when the module is missing, and can retry", async () => {
    const noContainer = createActor(encounterMachine, {
      input: {
        encounterId: "signal-lock",
        getContainer: () => null,
        load: async () => ({ mount: () => () => {} }),
      },
    }).start();
    await settle();
    expect(noContainer.getSnapshot().matches("failed")).toBe(true);

    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("no scene"))
      .mockResolvedValueOnce({ mount: () => () => {} });
    const actor = createActor(encounterMachine, {
      input: { encounterId: "nope", getContainer: () => container, load },
    }).start();
    await settle();
    expect(actor.getSnapshot().matches("failed")).toBe(true);
    actor.send({ type: "RETRY" });
    await settle();
    expect(actor.getSnapshot().matches("playing")).toBe(true);
  });

  it("tears the game down if the machine stops mid-play", async () => {
    const unmount = vi.fn();
    const runtime: EncounterRuntime = { mount: () => unmount };
    const actor = createActor(
      encounterMachine.provide({
        actors: {
          loadRuntime: fromPromise(
            async (): Promise<EncounterRuntime> => runtime,
          ),
        },
      }),
      {
        input: {
          encounterId: "signal-lock",
          getContainer: () => container,
          load: async () => runtime,
        },
      },
    ).start();
    await settle();
    actor.stop();
    expect(unmount).toHaveBeenCalledTimes(1);
  });
});
