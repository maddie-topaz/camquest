import { describe, expect, it } from "vitest";
import { getQuest } from "../content/quests";
import { jumpToStep, scenarios, scenariosById } from "../dev/scenarios";
import { START_UNLOCK_ID } from "../machines/quest";
import { questStatus } from "../rules";
import { resettableSystems } from "../types";
import { completed, created, granted, saveFrom } from "./helpers";

describe("dev events", () => {
  it("relock / forget undo their flags", () => {
    const save = saveFrom([
      created(),
      { type: "quest.unlocked", slug: "x", reason: "t" },
      { type: "location.discovered", locationId: "bar", reason: "t" },
      { type: "secret.found", secretId: "s", reason: "t" },
      { type: "quest.relocked", slug: "x", reason: "t" },
      { type: "location.forgotten", locationId: "bar", reason: "t" },
      { type: "secret.forgotten", secretId: "s", reason: "t" },
    ]);
    expect(save.world).toEqual({
      unlockedQuests: [],
      discoveredLocations: [],
      secrets: [],
    });
  });

  it("system.reset clears exactly one slice of the save", () => {
    const base = [
      created("Cam"),
      granted("cowbell", 2),
      completed("unknown-signal"),
      { type: "xp.gained" as const, amount: 300, reason: "t" },
      { type: "trait.changed" as const, trait: "chaos", delta: 3, reason: "t" },
      {
        type: "achievement.unlocked" as const,
        achievementId: "first-quest",
        reason: "t",
      },
    ];
    for (const system of resettableSystems) {
      const save = saveFrom([
        ...base,
        { type: "system.reset", system, reason: "t" },
      ]);
      expect(save.player.name).toBe("Cam");
      if (system === "inventory") {
        expect(save.player.inventory).toEqual({});
        expect(save.player.grants).toEqual([]);
      } else expect(save.player.inventory.cowbell.quantity).toBe(2);
      if (system === "xp") expect(save.player.xp).toBe(0);
      else expect(save.player.xp).toBe(300);
      if (system === "traits") expect(save.player.traits.chaos).toBe(5);
      else expect(save.player.traits.chaos).toBe(8);
      if (system === "quests") expect(save.quests).toEqual({});
      else expect(save.quests["unknown-signal"].completions).toBe(1);
      if (system === "achievements")
        expect(save.player.achievements).toEqual({});
      else expect(save.player.achievements["first-quest"]).toBeDefined();
    }
  });
});

describe("scenarios", () => {
  const play = (id: string, params = {}) =>
    saveFrom(scenariosById[id].events(params));

  it("every scenario produces a save", () => {
    for (const scenario of scenarios)
      expect(() =>
        play(scenario.id, { slug: "cams-gambit", step: 2 }),
      ).not.toThrow();
  });

  it("quest-ready satisfies requirements transitively and leaves the quest available", () => {
    const save = play("quest-ready", { slug: "cams-gambit" });
    expect(questStatus(save, getQuest("cams-gambit")!)).toBe("available");
    expect(save.quests["unknown-signal"].completions).toBe(1);
  });

  it("quest-in-progress jumps to the step with earlier passcodes unlocked", () => {
    const save = play("quest-in-progress", { slug: "cams-gambit", step: 2 });
    const progress = save.quests["cams-gambit"];
    expect(progress.step).toBe(2);
    expect(progress.unlockedSteps).toEqual([
      START_UNLOCK_ID,
      "load-cartridge",
      "load-map",
      "fate-engine",
    ]);
    expect(questStatus(save, getQuest("cams-gambit")!)).toBe("in-progress");
  });

  it("everything-unlocked completes every quest and maxes traits", () => {
    const save = play("everything-unlocked");
    expect(Object.values(save.quests).every((q) => q.completions > 0)).toBe(
      true,
    );
    expect(save.player.traits.chaos).toBe(10);
    expect(save.player.achievements["first-quest"]).toBeDefined();
  });

  it("jumpToStep clamps and keeps existing answers", () => {
    const quest = getQuest("cams-gambit")!;
    const events = jumpToStep(quest, 99, { "load-cartridge": "Sun Cartridge" });
    expect(events[1].payload).toMatchObject({
      type: "quest.progressed",
      step: quest.steps.length - 1,
      answers: { "load-cartridge": "Sun Cartridge" },
    });
  });
});
