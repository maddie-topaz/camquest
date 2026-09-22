import { describe, expect, it } from "vitest";
import { buildView } from "../view";
import { levelProgress } from "../content/levels";
import { saveFrom, created } from "./helpers";

describe("buildView companions", () => {
  it("is empty when no companion is registered", () => {
    const view = buildView(saveFrom([created()]));
    expect(view.companions).toEqual([]);
  });

  it("merges save state with the companion's content definition", () => {
    const save = saveFrom([
      created(),
      {
        type: "companion.registered",
        id: "kitana",
        name: "Kitana",
        species: "cat",
        reason: "test",
      },
      { type: "companion.xpGained", companionId: "kitana", amount: 150, reason: "t" },
    ]);
    const view = buildView(save);
    expect(view.companions).toHaveLength(1);
    const kitana = view.companions[0];
    expect(kitana.id).toBe("kitana");
    expect(kitana.name).toBe("Kitana");
    expect(kitana.species).toBe("cat");
    expect(kitana.companionClass).toBe("Feline");
    expect(kitana.xp).toBe(150);
    expect(kitana.level).toEqual(levelProgress(150));
    expect(kitana.stats.length).toBeGreaterThan(0);
  });

  it("falls back to generic presentation for an undefined companion id", () => {
    const save = saveFrom([
      created(),
      {
        type: "companion.registered",
        id: "mystery-pal",
        name: "Mystery Pal",
        species: "unknown",
        reason: "test",
      },
    ]);
    const view = buildView(save);
    expect(view.companions[0]).toMatchObject({
      companionClass: "Companion",
      icon: "PawPrint",
      stats: [],
    });
  });
});
