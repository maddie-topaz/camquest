import { describe, expect, it, vi } from "vitest";
import { createActor, fromPromise } from "xstate";
import {
  groupPendingGrants,
  startMachine,
  startSelectors,
  type StartEmitted,
} from "../machines/start";
import type { PendingGrantView, SaveView } from "../view";

const grant = (
  itemId: string,
  key: string,
  reason = "starter_loadout",
  quantity = 1,
): PendingGrantView => ({
  key,
  itemId,
  quantity,
  reason,
  at: "2026-01-01T00:00:00.000Z",
  name: itemId,
  description: "",
  icon: "Bell",
  color: "#fff",
  tilt: "0deg",
  sortOrder: 1,
});

const viewWith = (pendingGrants: PendingGrantView[]) =>
  ({ pendingGrants }) as unknown as SaveView;

const run = (
  pending: PendingGrantView[],
  accept: (keys: string[]) => Promise<unknown> = vi.fn(async () => {}),
) => {
  const emitted: StartEmitted[] = [];
  const machine = startMachine.provide({
    actors: {
      boot: fromPromise(async () => viewWith(pending)),
      accept: fromPromise(
        async ({
          input,
        }: {
          input: {
            accept: (keys: string[]) => Promise<unknown>;
            grantKeys: string[];
          };
        }) => {
          await accept(input.grantKeys);
        },
      ),
    },
    delays: { revealReady: 0 },
  });
  const actor = createActor(machine, {
    input: { load: async () => viewWith(pending), accept, minBootMs: 0 },
  });
  actor.on("cue", (e) => emitted.push(e));
  actor.on("enter", (e) => emitted.push(e));
  actor.start();
  return { actor, emitted, accept };
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

describe("groupPendingGrants", () => {
  it("merges the same item and keeps every key and reason", () => {
    const items = groupPendingGrants([
      grant("cowbell", "a"),
      grant("cowbell", "b", "gift", 2),
      grant("biltong-fragment", "c"),
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      itemId: "cowbell",
      quantity: 3,
      grantKeys: ["a", "b"],
      reasons: ["starter_loadout", "gift"],
    });
    expect(startSelectors.isFirstGrant(items)).toBe(false);
    expect(
      startSelectors.isFirstGrant(groupPendingGrants([grant("cowbell", "a")])),
    ).toBe(true);
  });
});

describe("startMachine", () => {
  it("skips straight in when nothing is pending", async () => {
    const { actor, emitted } = run([]);
    actor.send({ type: "START" });
    await settle();
    expect(actor.getSnapshot().matches("skipped")).toBe(true);
    expect(emitted.map((e) => e.type)).toEqual(["cue", "enter"]);
  });

  it("reveals pending grants, becomes ready, accepts exactly their keys, then enters", async () => {
    const { actor, emitted, accept } = run([
      grant("cowbell", "starter:cowbell"),
      grant("cowbell", "gift:1", "gift"),
    ]);
    actor.send({ type: "START" });
    await settle();
    expect(actor.getSnapshot().matches("ready")).toBe(true);
    expect(actor.getSnapshot().context.items[0].quantity).toBe(2);
    actor.send({ type: "ACCEPT" });
    await settle();
    expect(accept).toHaveBeenCalledWith(["starter:cowbell", "gift:1"]);
    expect(actor.getSnapshot().matches("accepted")).toBe(true);
    expect(
      emitted
        .filter((e) => e.type === "cue")
        .map((e) => (e as { cue: string }).cue),
    ).toEqual([
      "game-start",
      "inventory-open",
      "inventory-ready",
      "inventory-accepted",
    ]);
    expect(emitted.at(-1)?.type).toBe("enter");
  });

  it("stays on the reveal if accepting fails, and can retry a failed boot", async () => {
    const failing = vi.fn(async () => {
      throw new Error("offline");
    });
    const { actor } = run([grant("cowbell", "k")], failing);
    actor.send({ type: "START" });
    await settle();
    actor.send({ type: "ACCEPT" });
    await settle();
    expect(actor.getSnapshot().matches("ready")).toBe(true);

    const broken = createActor(
      startMachine.provide({
        actors: {
          boot: fromPromise(async (): Promise<SaveView> => {
            throw new Error("offline");
          }),
        },
      }),
      {
        input: {
          load: async () => viewWith([]),
          accept: async () => {},
          minBootMs: 0,
        },
      },
    ).start();
    broken.send({ type: "START" });
    await settle();
    expect(broken.getSnapshot().matches("error")).toBe(true);
    broken.send({ type: "RETRY" });
    expect(broken.getSnapshot().matches("booting")).toBe(true);
  });
});
