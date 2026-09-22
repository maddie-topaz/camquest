import { describe, expect, it } from "vitest";
import { applyEvent, emptySave } from "../reducer";
import { completed, created, granted, saveFrom } from "./helpers";

describe("reducer", () => {
  it("starts from an empty, versioned save", () => {
    const save = emptySave("cam");
    expect(save.playerId).toBe("cam");
    expect(save.seq).toBe(0);
    expect(save.player.inventory).toEqual({});
    expect(save.player.traits.chaos).toBe(5);
  });

  it("tracks seq and updatedAt from the last event", () => {
    const save = saveFrom([created(), granted("cowbell")]);
    expect(save.seq).toBe(2);
    expect(save.updatedAt).toBe("2026-01-01T00:00:02.000Z");
  });

  it("grants add to the pack and record a pending grant", () => {
    const save = saveFrom([created(), granted("cowbell", 2)]);
    expect(save.player.inventory.cowbell.quantity).toBe(2);
    expect(save.player.grants).toHaveLength(1);
    expect(save.player.grants[0].acceptedAt).toBeUndefined();
  });

  it("ignores a replayed grant with the same key", () => {
    const save = saveFrom([
      created(),
      granted("cowbell", 1, "test", "starter:cowbell"),
      granted("cowbell", 1, "test", "starter:cowbell"),
    ]);
    expect(save.player.inventory.cowbell.quantity).toBe(1);
    expect(save.player.grants).toHaveLength(1);
  });

  it("consuming removes the stack at zero and never goes negative", () => {
    const save = saveFrom([
      created(),
      granted("cowbell", 1),
      { type: "item.consumed", itemId: "cowbell", quantity: 5, reason: "test" },
    ]);
    expect(save.player.inventory.cowbell).toBeUndefined();
  });

  it("accept stamps only the named pending grants; rearm clears them", () => {
    const base = saveFrom([
      created(),
      granted("cowbell", 1, "test", "g1"),
      granted("biltong-fragment", 1, "test", "g2"),
    ]);
    const accepted = applyEvent(base, {
      seq: 4,
      key: "a",
      at: "2026-01-02T00:00:00.000Z",
      payload: { type: "grants.accepted", grantKeys: ["g1"] },
    });
    expect(accepted.player.grants.map((g) => Boolean(g.acceptedAt))).toEqual([
      true,
      false,
    ]);
    const rearmed = applyEvent(accepted, {
      seq: 5,
      key: "r",
      at: "2026-01-03T00:00:00.000Z",
      payload: { type: "grants.rearmed" },
    });
    expect(rearmed.player.grants.every((g) => !g.acceptedAt)).toBe(true);
  });

  it("clamps traits to their defined range", () => {
    const save = saveFrom([
      created(),
      { type: "trait.changed", trait: "chaos", delta: 40, reason: "test" },
    ]);
    expect(save.player.traits.chaos).toBe(10);
  });

  it("xp never drops below zero", () => {
    const save = saveFrom([
      created(),
      { type: "xp.gained", amount: -50, reason: "test" },
    ]);
    expect(save.player.xp).toBe(0);
  });

  it("quest completion counts and reset clears progress only", () => {
    const done = saveFrom([
      created(),
      completed("cams-gambit"),
      completed("cams-gambit"),
    ]);
    expect(done.quests["cams-gambit"].completions).toBe(2);
    const reset = applyEvent(done, {
      seq: 4,
      key: "x",
      at: "2026-01-04T00:00:00.000Z",
      payload: { type: "quest.reset", slug: "cams-gambit", reason: "test" },
    });
    expect(reset.quests["cams-gambit"]).toBeUndefined();
  });

  it("world sets are deduplicated", () => {
    const save = saveFrom([
      created(),
      { type: "quest.unlocked", slug: "x", reason: "t" },
      { type: "quest.unlocked", slug: "x", reason: "t" },
    ]);
    expect(save.world.unlockedQuests).toEqual(["x"]);
  });

  it("registers a companion once, keyed by id, starting at 0 xp", () => {
    const save = saveFrom([
      created(),
      {
        type: "companion.registered",
        id: "kitana",
        name: "Kitana",
        species: "cat",
        reason: "test",
      },
      // A second registration under the same id must not reset progress.
      { type: "companion.xpGained", companionId: "kitana", amount: 50, reason: "t" },
      {
        type: "companion.registered",
        id: "kitana",
        name: "Kitana",
        species: "cat",
        reason: "test",
      },
    ]);
    expect(Object.keys(save.player.companions)).toEqual(["kitana"]);
    expect(save.player.companions.kitana.name).toBe("Kitana");
    expect(save.player.companions.kitana.xp).toBe(50);
  });

  it("companion xp accrues independently of the player's own xp", () => {
    const save = saveFrom([
      created(),
      { type: "xp.gained", amount: 300, reason: "t" },
      {
        type: "companion.registered",
        id: "kitana",
        name: "Kitana",
        species: "cat",
        reason: "test",
      },
      { type: "companion.xpGained", companionId: "kitana", amount: 120, reason: "t" },
    ]);
    expect(save.player.xp).toBe(300);
    expect(save.player.companions.kitana.xp).toBe(120);
  });

  it("companion xp never drops below zero and ignores an unregistered companion", () => {
    const save = saveFrom([
      created(),
      // No matching companion yet — the event is tolerated, not applied.
      { type: "companion.xpGained", companionId: "ghost", amount: 10, reason: "t" },
      {
        type: "companion.registered",
        id: "kitana",
        name: "Kitana",
        species: "cat",
        reason: "test",
      },
      { type: "companion.xpGained", companionId: "kitana", amount: -999, reason: "t" },
    ]);
    expect(save.player.companions.ghost).toBeUndefined();
    expect(save.player.companions.kitana.xp).toBe(0);
  });

  it("equips an item by reference without touching inventory quantity", () => {
    const save = saveFrom([
      created(),
      granted("cowbell", 1),
      {
        type: "item.equipped",
        ownerId: "kitana",
        itemId: "cowbell",
        reason: "test",
      },
    ]);
    expect(save.player.equipment.kitana).toEqual(["cowbell"]);
    expect(save.player.inventory.cowbell.quantity).toBe(1);
  });

  it("equipping the same item twice does not duplicate the slot", () => {
    const save = saveFrom([
      created(),
      granted("cowbell", 1),
      {
        type: "item.equipped",
        ownerId: "kitana",
        itemId: "cowbell",
        reason: "test",
      },
      {
        type: "item.equipped",
        ownerId: "kitana",
        itemId: "cowbell",
        reason: "test",
      },
    ]);
    expect(save.player.equipment.kitana).toEqual(["cowbell"]);
  });

  it("unequip removes only the named item and leaves inventory untouched", () => {
    const save = saveFrom([
      created(),
      granted("cowbell", 1),
      granted("kitanas-blessing", 1),
      {
        type: "item.equipped",
        ownerId: "kitana",
        itemId: "cowbell",
        reason: "test",
      },
      {
        type: "item.equipped",
        ownerId: "kitana",
        itemId: "kitanas-blessing",
        reason: "test",
      },
      {
        type: "item.unequipped",
        ownerId: "kitana",
        itemId: "cowbell",
        reason: "test",
      },
    ]);
    expect(save.player.equipment.kitana).toEqual(["kitanas-blessing"]);
    expect(save.player.inventory.cowbell.quantity).toBe(1);
  });

  it("resetting inventory also clears equipment so no phantom equip remains", () => {
    const save = saveFrom([
      created(),
      granted("cowbell", 1),
      {
        type: "item.equipped",
        ownerId: "kitana",
        itemId: "cowbell",
        reason: "test",
      },
      { type: "system.reset", system: "inventory", reason: "test" },
    ]);
    expect(save.player.equipment).toEqual({});
    expect(save.player.inventory).toEqual({});
  });
});
