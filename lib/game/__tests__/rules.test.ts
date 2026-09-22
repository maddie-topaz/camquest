import { describe, expect, it } from "vitest";
import { levelForXp, xpForLevel } from "../content/levels";
import {
  canConsume,
  missingRequirements,
  newlyEarnedAchievements,
  questStatus,
} from "../rules";
import { getQuest } from "../content/quests";
import { completed, created, granted, saveFrom } from "./helpers";

describe("levels", () => {
  it("is quadratic and monotonic", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(5)).toBe(1600);
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(1600)).toBe(5);
  });
});

describe("inventory rules", () => {
  it("rejects unknown, non-consumable, and insufficient items", () => {
    const save = saveFrom([
      created(),
      granted("kitanas-blessing"),
      granted("cowbell"),
    ]);
    expect(canConsume(save, "nope", 1)).toMatchObject({
      ok: false,
      code: "unknown-item",
    });
    expect(canConsume(save, "kitanas-blessing", 1)).toMatchObject({
      ok: false,
      code: "not-consumable",
    });
    expect(canConsume(save, "cowbell", 2)).toMatchObject({
      ok: false,
      code: "insufficient",
    });
    expect(canConsume(save, "cowbell", 1)).toEqual({ ok: true });
  });
});

describe("prerequisites", () => {
  it("reports exactly what is missing, in requirement shape", () => {
    const save = saveFrom([created()]);
    const missing = missingRequirements(
      save,
      {
        items: ["vip-wristband"],
        questsCompleted: ["cams-gambit"],
        traits: { chaos: 8 },
        level: 3,
        unlock: true,
      },
      "unknown-signal",
    );
    expect(missing).toEqual({
      items: ["vip-wristband"],
      questsCompleted: ["cams-gambit"],
      traits: { chaos: 8 },
      level: 3,
      unlock: true,
    });
  });

  it("is empty once everything is satisfied", () => {
    const save = saveFrom([
      created(),
      granted("vip-wristband"),
      completed("cams-gambit"),
      { type: "trait.changed", trait: "chaos", delta: 3, reason: "t" },
      { type: "xp.gained", amount: 400, reason: "t" },
      { type: "quest.unlocked", slug: "unknown-signal", reason: "t" },
    ]);
    expect(
      missingRequirements(
        save,
        {
          items: ["vip-wristband"],
          questsCompleted: ["cams-gambit"],
          traits: { chaos: 8 },
          level: 3,
          unlock: true,
        },
        "unknown-signal",
      ),
    ).toEqual({});
  });
});

describe("quest status", () => {
  const gambit = getQuest("cams-gambit")!;
  const signal = getQuest("unknown-signal")!;

  it("derives available → in-progress → completed", () => {
    expect(questStatus(saveFrom([created()]), signal)).toBe("available");
    expect(
      questStatus(
        saveFrom([
          created(),
          { type: "quest.started", slug: "unknown-signal" },
        ]),
        signal,
      ),
    ).toBe("in-progress");
    expect(
      questStatus(saveFrom([created(), completed("unknown-signal")]), signal),
    ).toBe("completed");
  });

  it("locks a quest with unmet requirements until they are met", () => {
    expect(questStatus(saveFrom([created()]), gambit)).toBe("locked");
    expect(
      questStatus(saveFrom([created(), completed("unknown-signal")]), gambit),
    ).toBe("available");
  });
});

describe("achievements", () => {
  it("earns condition achievements from the save alone", () => {
    expect(newlyEarnedAchievements(saveFrom([created()]))).toEqual([]);
    expect(
      newlyEarnedAchievements(saveFrom([created(), completed("cams-gambit")])),
    ).toContain("first-quest");
    expect(
      newlyEarnedAchievements(
        saveFrom([created(), granted("kitanas-blessing")]),
      ),
    ).toContain("blessed-by-kitana");
  });

  it("does not re-earn one already recorded", () => {
    const save = saveFrom([
      created(),
      completed("cams-gambit"),
      {
        type: "achievement.unlocked",
        achievementId: "first-quest",
        reason: "t",
      },
    ]);
    expect(newlyEarnedAchievements(save)).not.toContain("first-quest");
  });
});
