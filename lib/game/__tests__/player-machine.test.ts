import { describe, expect, it, vi } from "vitest";
import { createActor } from "xstate";
import { playerMachine, type PlayerEmitted } from "../machines/player";
import type { SaveView } from "../view";

const view = (seq: number) => ({ save: { seq } }) as unknown as SaveView;
const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

describe("playerMachine", () => {
  it("loads the view then runs queued commands one at a time, in order", async () => {
    const order: string[] = [];
    const run = vi.fn(async (command: { type: string }) => {
      order.push(`start:${command.type}`);
      await settle();
      order.push(`end:${command.type}`);
      return view(order.length);
    });
    const emitted: PlayerEmitted[] = [];
    const actor = createActor(playerMachine, {
      input: { load: async () => view(0), run, admin: async () => view(0) },
    });
    actor.on("job.done", (e) => emitted.push(e));
    actor.start();
    // Queued before the save has even loaded.
    actor.send({
      type: "COMMAND",
      id: "a",
      command: { type: "quest.start", slug: "cams-gambit" },
    });
    actor.send({
      type: "COMMAND",
      id: "b",
      command: { type: "grants.accept", grantKeys: [] },
    });
    await settle();
    await settle();
    await settle();
    await settle();
    expect(actor.getSnapshot().matches("ready")).toBe(true);
    expect(order).toEqual([
      "start:quest.start",
      "end:quest.start",
      "start:grants.accept",
      "end:grants.accept",
    ]);
    expect(emitted.map((e) => e.id)).toEqual(["a", "b"]);
    expect(actor.getSnapshot().context.view?.save.seq).toBe(4);
  });

  it("a failed command emits job.failed, keeps the last good view, and the queue continues", async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error("locked"))
      .mockResolvedValueOnce(view(9));
    const emitted: PlayerEmitted[] = [];
    const actor = createActor(playerMachine, {
      input: { load: async () => view(1), run, admin: async () => view(0) },
    });
    actor.on("job.done", (e) => emitted.push(e));
    actor.on("job.failed", (e) => emitted.push(e));
    actor.start();
    await settle();
    actor.send({
      type: "COMMAND",
      id: "x",
      command: { type: "quest.start", slug: "unknown-signal" },
    });
    actor.send({
      type: "COMMAND",
      id: "y",
      command: { type: "quest.start", slug: "cams-gambit" },
    });
    await settle();
    await settle();
    await settle();
    expect(emitted.map((e) => `${e.type}:${e.id}`)).toEqual([
      "job.failed:x",
      "job.done:y",
    ]);
    expect(actor.getSnapshot().context.view?.save.seq).toBe(9);
    expect(actor.getSnapshot().context.queue).toEqual([]);
  });

  it("a failed load can be retried", async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(view(2));
    const actor = createActor(playerMachine, {
      input: { load, run: async () => view(0), admin: async () => view(0) },
    }).start();
    await settle();
    expect(actor.getSnapshot().matches("failed")).toBe(true);
    actor.send({ type: "RETRY" });
    await settle();
    expect(actor.getSnapshot().matches("ready")).toBe(true);
  });
});
