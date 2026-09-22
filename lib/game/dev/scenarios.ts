// Test scenarios: named recipes that produce the events for a known save
// state, starting from a freshly bootstrapped player. Pure: they read
// content only, so a scenario is the same on every database. The admin
// API wipes the save, bootstraps, then appends what a recipe returns.

import { achievements } from "../content/achievements";
import { items, starterLoadout } from "../content/items";
import { getQuest, quests, type QuestDefinition } from "../content/quests";
import { traits } from "../content/traits";
import { START_UNLOCK_ID } from "../machines/quest";
import type { NewGameEvent } from "../types";

export type ScenarioParams = { slug?: string; step?: number };

export type ScenarioDefinition = {
  id: string;
  name: string;
  description: string;
  // Which params the UI should ask for.
  needs?: ("slug" | "step")[];
  events: (params: ScenarioParams) => NewGameEvent[];
};

const reason = "scenario";

// Every starter grant, accepted, so START goes straight in.
const acceptStarters = (): NewGameEvent[] => [
  {
    payload: {
      type: "grants.accepted",
      grantKeys: starterLoadout.map((entry) => `starter:${entry.itemId}`),
    },
  },
];

const grantAllItems = (): NewGameEvent[] =>
  items
    .filter((item) => !starterLoadout.some((entry) => entry.itemId === item.id))
    .map((item) => ({
      key: `scenario:item:${item.id}`,
      payload: {
        type: "item.granted" as const,
        itemId: item.id,
        quantity: 1,
        reason,
      },
    }));

const acceptEverything = (): NewGameEvent[] => [
  {
    payload: {
      type: "grants.accepted",
      grantKeys: [
        ...starterLoadout.map((e) => `starter:${e.itemId}`),
        ...items.map((i) => `scenario:item:${i.id}`),
      ],
    },
  },
];

// The events that make a quest's requirements true, recursively for the
// quests it depends on. Completions are raw (no rewards) so the scenario
// stays predictable.
const satisfyRequirements = (
  quest: QuestDefinition,
  seen = new Set<string>(),
): NewGameEvent[] => {
  const events: NewGameEvent[] = [];
  const req = quest.requirements;
  if (!req) return events;
  for (const slug of req.questsCompleted ?? []) {
    if (seen.has(slug)) continue;
    seen.add(slug);
    const other = getQuest(slug);
    if (!other) continue;
    events.push(...satisfyRequirements(other, seen));
    events.push({
      key: `scenario:complete:${slug}`,
      payload: { type: "quest.completed", slug, answers: {} },
    });
  }
  for (const itemId of req.items ?? []) {
    if (starterLoadout.some((e) => e.itemId === itemId)) continue;
    events.push({
      key: `scenario:item:${itemId}`,
      payload: { type: "item.granted", itemId, quantity: 1, reason },
    });
  }
  for (const [trait, min] of Object.entries(req.traits ?? {})) {
    const initial = traits.find((t) => t.id === trait)?.initial ?? 0;
    if (min > initial)
      events.push({
        payload: { type: "trait.changed", trait, delta: min - initial, reason },
      });
  }
  if (req.level && req.level > 1)
    events.push({
      payload: {
        type: "xp.gained",
        amount: 100 * (req.level - 1) * (req.level - 1),
        reason,
      },
    });
  for (const id of req.achievements ?? [])
    events.push({
      payload: { type: "achievement.unlocked", achievementId: id, reason },
    });
  if (req.unlock)
    events.push({
      payload: { type: "quest.unlocked", slug: quest.slug, reason },
    });
  return events;
};

// Progress events that put a quest at `step`, with every passcode before
// it (and the start gate) already entered.
export const jumpToStep = (
  quest: QuestDefinition,
  step: number,
  answers: Record<string, string> = {},
): NewGameEvent[] => {
  const target = Math.max(
    0,
    Math.min(step, Math.max(0, quest.steps.length - 1)),
  );
  const unlockedSteps = [
    ...(quest.startPasscode ? [START_UNLOCK_ID] : []),
    ...quest.steps
      .slice(0, target + 1)
      .filter((s) => s.passcode)
      .map((s) => s.id),
  ];
  return [
    { payload: { type: "quest.started", slug: quest.slug } },
    {
      payload: {
        type: "quest.progressed",
        slug: quest.slug,
        step: target,
        answers,
        unlockedSteps,
      },
    },
  ];
};

export const scenarios: ScenarioDefinition[] = [
  {
    id: "fresh-player",
    name: "Fresh player",
    description:
      "Brand-new save: starter pack pending, nothing played. Exactly what a first START sees.",
    events: () => [],
  },
  {
    id: "all-items",
    name: "All items unlocked",
    description:
      "Every item in the catalogue in the pack, all grants accepted.",
    events: () => [...grantAllItems(), ...acceptEverything()],
  },
  {
    id: "quest-ready",
    name: "Quest ready to start",
    description:
      "Fresh save with the chosen quest's requirements satisfied and the starter pack accepted.",
    needs: ["slug"],
    events: ({ slug }) => {
      const quest = slug ? getQuest(slug) : undefined;
      return quest ? [...acceptStarters(), ...satisfyRequirements(quest)] : [];
    },
  },
  {
    id: "quest-in-progress",
    name: "Quest in progress",
    description:
      "As above, then the quest jumped to the chosen step with earlier passcodes entered.",
    needs: ["slug", "step"],
    events: ({ slug, step }) => {
      const quest = slug ? getQuest(slug) : undefined;
      return quest
        ? [
            ...acceptStarters(),
            ...satisfyRequirements(quest),
            ...jumpToStep(quest, step ?? 0),
          ]
        : [];
    },
  },
  {
    id: "everything-unlocked",
    name: "Everything unlocked",
    description:
      "All items, every quest completed, every achievement, traits maxed.",
    events: () => [
      ...grantAllItems(),
      ...acceptEverything(),
      ...quests.map((quest) => ({
        key: `scenario:complete:${quest.slug}`,
        payload: {
          type: "quest.completed" as const,
          slug: quest.slug,
          answers: {},
        },
      })),
      ...quests.map((quest) => ({
        payload: { type: "quest.unlocked" as const, slug: quest.slug, reason },
      })),
      ...achievements.map((a) => ({
        payload: {
          type: "achievement.unlocked" as const,
          achievementId: a.id,
          reason,
        },
      })),
      ...traits.map((t) => ({
        payload: {
          type: "trait.changed" as const,
          trait: t.id,
          delta: t.max - t.initial,
          reason,
        },
      })),
    ],
  },
];

export const scenariosById: Record<string, ScenarioDefinition> =
  Object.fromEntries(scenarios.map((s) => [s.id, s]));
