import { describe, expect, it, vi } from "vitest";
import { createActor } from "xstate";
import { resolveSound, sounds } from "../content/audio";
import { audioMachine, type AudioPlayer } from "../machines/audio";

const recorder = () => {
  const played: string[] = [];
  const volumes: number[] = [];
  const player: AudioPlayer = {
    play: (cue) => played.push(cue),
    setVolume: (v) => volumes.push(v),
    unlock: async () => true,
  };
  return { player, played, volumes };
};

describe("audioMachine", () => {
  it("plays the latest cue once the browser has been unlocked by a gesture", () => {
    const { player, played } = recorder();
    const actor = createActor(audioMachine, { input: { player } }).start();
    actor.send({ type: "CUE", cue: "game-start" });
    expect(played).toEqual([]);
    actor.send({ type: "UNLOCKED" });
    expect(played).toEqual(["game-start"]);
    actor.send({ type: "CUE", cue: "game-start" });
    expect(played).toEqual(["game-start", "game-start"]);
  });

  it("mute silences the player and stops cues; unmute restores volume", () => {
    const { player, played, volumes } = recorder();
    const actor = createActor(audioMachine, {
      input: { player, volume: 0.5 },
    }).start();
    actor.send({ type: "UNLOCKED" });
    actor.send({ type: "TOGGLE_MUTE" });
    expect(actor.getSnapshot().matches("muted")).toBe(true);
    expect(volumes.at(-1)).toBe(0);
    actor.send({ type: "CUE", cue: "choice-select" });
    expect(played).toEqual([]);
    actor.send({ type: "TOGGLE_MUTE" });
    expect(volumes.at(-1)).toBe(0.5);
    actor.send({ type: "CUE", cue: "choice-select" });
    expect(played).toEqual(["choice-select"]);
  });

  it("a save-time mute preference lands in muted once unlocked", () => {
    const { player } = recorder();
    const actor = createActor(audioMachine, {
      input: { player, muted: true },
    }).start();
    actor.send({ type: "UNLOCKED" });
    expect(actor.getSnapshot().matches("muted")).toBe(true);
  });

  it("clamps volume", () => {
    const { player, volumes } = recorder();
    const actor = createActor(audioMachine, { input: { player } }).start();
    actor.send({ type: "SET_VOLUME", volume: 4 });
    expect(volumes.at(-1)).toBe(1);
  });
});

describe("sound registry", () => {
  it("resolves every registered cue to a file under /audio", () => {
    for (const cue of Object.keys(sounds)) {
      expect(resolveSound(cue, undefined)?.file).toMatch(
        /^\/audio\/[a-z-]+\.wav$/,
      );
    }
    expect(resolveSound("not-a-cue", undefined)).toBeNull();
  });

  it("pitches item-acquired up with each card", () => {
    expect(resolveSound("item-acquired", { index: 0 })?.rate).toBe(1);
    expect(resolveSound("item-acquired", { index: 3 })?.rate).toBeCloseTo(1.36);
  });
});

describe("generated palette", () => {
  it("has a file in public/audio for every registered cue", async () => {
    const { existsSync } = await import("node:fs");
    const missing = Object.values(sounds)
      .map((s) => s.file)
      .filter((file) => !existsSync(`public/audio/${file}.wav`));
    expect(missing).toEqual([]);
  });
});
