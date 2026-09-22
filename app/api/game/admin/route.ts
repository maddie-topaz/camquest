import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { achievementsById } from "@/lib/game/content/achievements";
import { getItem } from "@/lib/game/content/items";
import { getQuest } from "@/lib/game/content/quests";
import { traitsById } from "@/lib/game/content/traits";
import { devToolsEnabled } from "@/lib/game/dev/enabled";
import {
  jumpToStep,
  scenariosById,
  type ScenarioParams,
} from "@/lib/game/dev/scenarios";
import { appendEvents, listEvents, loadSave, wipeSave } from "@/lib/game/store";
import {
  resettableSystems,
  type NewGameEvent,
  type ResettableSystem,
  type SaveFile,
} from "@/lib/game/types";
import { buildView } from "@/lib/game/view";

export const runtime = "nodejs";

// The FORCE path. Every action here appends raw events with no rule
// checks, so anything it does is visible in the log but nothing here is
// validated by the engine. Rule-checked changes go through
// /api/game/command instead. Only reachable with dev tools enabled.
export type AdminAction =
  // Player
  | { action: "rename"; name: string }
  | { action: "xp"; amount: number; reason?: string }
  | { action: "trait"; trait: string; delta: number; reason?: string }
  | { action: "set-trait"; trait: string; value: number }
  | { action: "achievement"; achievementId: string; unlocked: boolean }
  // Inventory
  | { action: "grant"; itemId: string; quantity?: number; reason?: string }
  | { action: "remove-item"; itemId: string; quantity?: number }
  | { action: "rearm" }
  | { action: "accept-all" }
  // Quests (rules bypassed; use commands for the real thing)
  | { action: "start-quest"; slug: string }
  | { action: "jump-quest"; slug: string; step: number }
  | { action: "reset-step"; slug: string; stepId: string }
  | { action: "mark-complete"; slug: string }
  | { action: "reset-quest"; slug: string }
  | { action: "unlock-quest"; slug: string }
  | { action: "relock-quest"; slug: string }
  // World flags
  | { action: "flag"; kind: "location" | "secret"; id: string; on: boolean }
  // Save
  | { action: "reset-system"; system: ResettableSystem }
  | { action: "wipe" }
  | { action: "scenario"; id: string; params?: ScenarioParams };

const toEvents = (
  body: AdminAction,
  save: SaveFile,
): NewGameEvent[] | string => {
  switch (body.action) {
    case "rename":
      if (!body.name?.trim()) return "name is required";
      return [
        {
          payload: {
            type: "player.renamed",
            name: body.name.trim().slice(0, 40),
          },
        },
      ];
    case "xp":
      if (!Number.isInteger(body.amount)) return "amount must be an integer";
      return [
        {
          payload: {
            type: "xp.gained",
            amount: body.amount,
            reason: body.reason || "admin",
          },
        },
      ];
    case "trait":
      if (!traitsById[body.trait]) return `No such trait: ${body.trait}`;
      if (!Number.isInteger(body.delta)) return "delta must be an integer";
      return [
        {
          payload: {
            type: "trait.changed",
            trait: body.trait,
            delta: body.delta,
            reason: body.reason || "admin",
          },
        },
      ];
    case "set-trait": {
      if (!traitsById[body.trait]) return `No such trait: ${body.trait}`;
      if (!Number.isInteger(body.value)) return "value must be an integer";
      const delta = body.value - (save.player.traits[body.trait] ?? 0);
      return delta === 0
        ? []
        : [
            {
              payload: {
                type: "trait.changed",
                trait: body.trait,
                delta,
                reason: "admin",
              },
            },
          ];
    }
    case "achievement":
      if (!achievementsById[body.achievementId])
        return `No such achievement: ${body.achievementId}`;
      return [
        {
          payload: body.unlocked
            ? {
                type: "achievement.unlocked",
                achievementId: body.achievementId,
                reason: "admin",
              }
            : {
                type: "achievement.revoked",
                achievementId: body.achievementId,
                reason: "admin",
              },
        },
      ];

    case "grant": {
      const quantity = body.quantity ?? 1;
      if (!getItem(body.itemId)) return `No such item: ${body.itemId}`;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99)
        return "quantity must be 1–99";
      return [
        {
          key: `gift:${randomUUID()}`,
          payload: {
            type: "item.granted",
            itemId: body.itemId,
            quantity,
            reason: body.reason || "gift",
          },
        },
      ];
    }
    case "remove-item": {
      const quantity = body.quantity ?? 1;
      if (!getItem(body.itemId)) return `No such item: ${body.itemId}`;
      if (!Number.isInteger(quantity) || quantity < 1)
        return "quantity must be a positive integer";
      return [
        {
          payload: {
            type: "item.consumed",
            itemId: body.itemId,
            quantity,
            reason: "admin",
          },
        },
      ];
    }
    case "rearm":
      return [{ payload: { type: "grants.rearmed" } }];
    case "accept-all": {
      const pending = save.player.grants
        .filter((g) => !g.acceptedAt)
        .map((g) => g.key);
      return pending.length
        ? [{ payload: { type: "grants.accepted", grantKeys: pending } }]
        : [];
    }

    case "start-quest":
      if (!getQuest(body.slug)) return `No such quest: ${body.slug}`;
      return [{ payload: { type: "quest.started", slug: body.slug } }];
    case "jump-quest": {
      const quest = getQuest(body.slug);
      if (!quest) return `No such quest: ${body.slug}`;
      if (!Number.isInteger(body.step)) return "step must be an integer";
      return jumpToStep(
        quest,
        body.step,
        save.quests[body.slug]?.answers ?? {},
      );
    }
    case "reset-step": {
      const quest = getQuest(body.slug);
      if (!quest) return `No such quest: ${body.slug}`;
      const index = quest.steps.findIndex((s) => s.id === body.stepId);
      if (index < 0) return `No such step: ${body.stepId}`;
      const current = save.quests[body.slug];
      if (!current) return [];
      const { [body.stepId]: _dropped, ...answers } = current.answers;
      return [
        {
          payload: {
            type: "quest.progressed",
            slug: body.slug,
            step: Math.min(current.step, index),
            answers,
            unlockedSteps: current.unlockedSteps.filter(
              (id) => id !== body.stepId,
            ),
          },
        },
      ];
    }
    case "mark-complete":
      if (!getQuest(body.slug)) return `No such quest: ${body.slug}`;
      return [
        {
          payload: {
            type: "quest.completed",
            slug: body.slug,
            answers: save.quests[body.slug]?.answers ?? {},
          },
        },
      ];
    case "reset-quest":
      if (!getQuest(body.slug)) return `No such quest: ${body.slug}`;
      return [
        { payload: { type: "quest.reset", slug: body.slug, reason: "admin" } },
      ];
    case "unlock-quest":
      if (!getQuest(body.slug)) return `No such quest: ${body.slug}`;
      return [
        {
          payload: { type: "quest.unlocked", slug: body.slug, reason: "admin" },
        },
      ];
    case "relock-quest":
      if (!getQuest(body.slug)) return `No such quest: ${body.slug}`;
      return [
        {
          payload: { type: "quest.relocked", slug: body.slug, reason: "admin" },
        },
      ];

    case "flag": {
      const id = body.id?.trim();
      if (!id) return "id is required";
      if (body.kind === "location")
        return [
          {
            payload: body.on
              ? { type: "location.discovered", locationId: id, reason: "admin" }
              : { type: "location.forgotten", locationId: id, reason: "admin" },
          },
        ];
      return [
        {
          payload: body.on
            ? { type: "secret.found", secretId: id, reason: "admin" }
            : { type: "secret.forgotten", secretId: id, reason: "admin" },
        },
      ];
    }

    case "reset-system":
      if (!resettableSystems.includes(body.system))
        return `No such system: ${body.system}`;
      return [
        {
          payload: {
            type: "system.reset",
            system: body.system,
            reason: "admin",
          },
        },
      ];

    default:
      return "Unknown action";
  }
};

export async function POST(request: NextRequest) {
  if (!devToolsEnabled)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await request.json().catch(() => null)) as AdminAction | null;
  if (!body?.action)
    return NextResponse.json({ error: "action is required" }, { status: 400 });

  try {
    // The two operations that don't append to the current log.
    if (body.action === "wipe") {
      return NextResponse.json({
        applied: [],
        view: buildView(await wipeSave()),
      });
    }
    if (body.action === "scenario") {
      const scenario = scenariosById[body.id];
      if (!scenario)
        return NextResponse.json(
          { error: `No such scenario: ${body.id}` },
          { status: 400 },
        );
      await wipeSave();
      const { save, applied } = await appendEvents(
        scenario.events(body.params ?? {}),
      );
      return NextResponse.json({ applied, view: buildView(save) });
    }

    const current = await loadSave();
    const events = toEvents(body, current);
    if (typeof events === "string")
      return NextResponse.json({ error: events }, { status: 400 });
    const { save, applied } = await appendEvents(events);
    return NextResponse.json({ applied, view: buildView(save) });
  } catch (error) {
    console.error("Admin action failed", body.action, error);
    return NextResponse.json({ error: "Admin action failed" }, { status: 500 });
  }
}

// Recent event history, newest first.
export async function GET(request: NextRequest) {
  if (!devToolsEnabled)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const limit = Math.min(
    500,
    Math.max(1, Number(request.nextUrl.searchParams.get("limit") || 100)),
  );
  try {
    return NextResponse.json({ events: await listEvents(undefined, limit) });
  } catch (error) {
    console.error("Failed to list events", error);
    return NextResponse.json(
      { error: "Failed to list events" },
      { status: 500 },
    );
  }
}
