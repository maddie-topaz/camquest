import { describe, expect, it } from "vitest";
import { traits, initialTraits } from "../content/traits";
import { tendencies, initialTendencies } from "../content/tendencies";

describe("traits content (abilities)", () => {
  it("has a unique id, a color and an icon for every trait", () => {
    const ids = traits.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const trait of traits) {
      expect(trait.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(trait.icon).toBeTruthy();
    }
  });

  it("initialTraits seeds every defined trait at its initial value", () => {
    const initial = initialTraits();
    expect(Object.keys(initial).sort()).toEqual(
      traits.map((t) => t.id).sort(),
    );
    for (const trait of traits) expect(initial[trait.id]).toBe(trait.initial);
  });
});

describe("tendencies content (flavor)", () => {
  it("has a unique id, a color and an icon for every tendency", () => {
    const ids = tendencies.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const tendency of tendencies) {
      expect(tendency.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(tendency.icon).toBeTruthy();
    }
  });

  it("initialTendencies seeds every defined tendency at its initial value", () => {
    const initial = initialTendencies();
    expect(Object.keys(initial).sort()).toEqual(
      tendencies.map((t) => t.id).sort(),
    );
    for (const tendency of tendencies)
      expect(initial[tendency.id]).toBe(tendency.initial);
  });
});

describe("traits vs tendencies", () => {
  it("never share an id, so a reward/requirement key is unambiguous", () => {
    const traitIds = new Set(traits.map((t) => t.id));
    const overlap = tendencies.filter((t) => traitIds.has(t.id));
    expect(overlap).toEqual([]);
  });

  it("colors are distinct across the combined set, so each dial reads uniquely", () => {
    const colors = [...traits, ...tendencies].map((t) => t.color.toLowerCase());
    expect(new Set(colors).size).toBe(colors.length);
  });
});
