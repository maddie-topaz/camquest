import { describe, expect, it } from "vitest";
import { levelForXp, xpForLevel } from "../content/levels";
import {
  canConsume,
  canEquip,
  canUnequip,
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
      granted("biltong-fragment"),
    ]);
    expect(canConsume(save, "nope", 1)).toMatchObject({
      ok: false,
      code: "unknown-item",
    });
    // A keepsake with no "consumable" trait can't be spent.
    expect(canConsume(save, "kitanas-blessing", 1)).toMatchObject({
      ok: false,
      code: "not-consumable",
    });
    // A trinket with only the "usable" trait can't be spent either —
    // "usable" and "consumable" are independent traits.
    expect(canConsume(save, "cowbell", 1)).toMatchObject({
      ok: false,
      code: "not-consumable",
    });
    expect(canConsume(save, "biltong-fragment", 2)).toMatchObject({
      ok: false,
      code: "insufficient",
    });
    expect(canConsume(save, "biltong-fragment", 1)).toEqual({ ok: true });
  });
});

describe("equipment rules", () => {
  it("rejects an unknown item, a non-equippable one, and an ineligible owner", () => {
    const save = saveFrom([created(), granted("cowbell"), granted("golden-key")]);
    expect(canEquip(save, "kitana", "nope")).toMatchObject({
      ok: false,
      code: "unknown-item",
    });
    // golden-key is usable/access but not equippable.
    expect(canEquip(save, "kitana", "golden-key")).toMatchObject({
      ok: false,
      code: "not-equippable",
    });
    // cowbell is equippable, but only by kitana.
    expect(canEquip(save, "cam", "cowbell")).toMatchObject({
      ok: false,
      code: "not-eligible",
    });
  });

  it("rejects equipping an item that isn't owned", () => {
    const save = saveFrom([created()]);
    expect(canEquip(save, "kitana", "cowbell")).toMatchObject({
      ok: false,
      code: "insufficient",
    });
  });

  it("allows equipping an owned, eligible item, and rejects doing it twice", () => {
    const save = saveFrom([created(), granted("cowbell")]);
    expect(canEquip(save, "kitana", "cowbell")).toEqual({ ok: true });
    const equipped = saveFrom([
      created(),
      granted("cowbell"),
      { type: "item.equipped", ownerId: "kitana", itemId: "cowbell", reason: "t" },
    ]);
    expect(canEquip(equipped, "kitana", "cowbell")).toMatchObject({
      ok: false,
      code: "already-equipped",
    });
  });

  it("unequip requires the item to currently be equipped", () => {
    const save = saveFrom([created(), granted("cowbell")]);
    expect(canUnequip(save, "kitana", "cowbell")).toMatchObject({
      ok: false,
      code: "not-equipped",
    });
    const equipped = saveFrom([
      created(),
      granted("cowbell"),
      { type: "item.equipped", ownerId: "kitana", itemId: "cowbell", reason: "t" },
    ]);
    expect(canUnequip(equipped, "kitana", "cowbell")).toEqual({ ok: true });
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
