// The quest engine. A command is what the UI wants to happen; the handler
// checks it against the save and answers with the events that make it so,
// or a rejection. It never writes anything: the store commits the events,
// which keeps this pure and testable.

import { getEncounter } from "./content/encounters";
import { getItem } from "./content/items";
import { getQuest, type QuestDefinition } from "./content/quests";
import { applyEvent } from "./reducer";
import {
  canConsume,
  canEquip,
  canStartQuest,
  canUnequip,
  hasCompleted,
  newlyEarnedAchievements,
  pendingGrants,
} from "./rules";
import type {
  Command,
  CommandResult,
  GameEvent,
  NewGameEvent,
  Requirements,
  Rewards,
  SaveFile,
} from "./types";

const reject = (
  code: string,
  message: string,
  missing?: Requirements,
): CommandResult => ({ ok: false, rejection: { code, message, missing } });

// Applies not-yet-committed events to a save so later checks (achievement
// conditions, a second reward) see the intermediate state. Sequence
// numbers here are provisional; the store assigns the real ones.
const simulate = (save: SaveFile, events: NewGameEvent[], at: string) =>
  events.reduce<SaveFile>(
    (state, event, index) =>
      applyEvent(state, {
        seq: state.seq + index + 1,
        key: event.key ?? `sim:${index}`,
        at,
        payload: event.payload,
      } as GameEvent),
    save,
  );

// Turns a Rewards block into keyed events. Same keyPrefix twice = no
// second payout, which is how first-completion rewards stay one-shot.
const rewardsToEvents = (
  save: SaveFile,
  rewards: Rewards | undefined,
  keyPrefix: string,
  reason: string,
  questSlug: string,
): NewGameEvent[] => {
  if (!rewards) return [];
  const events: NewGameEvent[] = [];

  if (rewards.xp)
    events.push({
      key: `${keyPrefix}:xp`,
      payload: { type: "xp.gained", amount: rewards.xp, reason, questSlug },
    });
  for (const reward of rewards.items ?? []) {
    if (!getItem(reward.itemId)) continue;
    events.push({
      key: `${keyPrefix}:item:${reward.itemId}`,
      payload: {
        type: "item.granted",
        itemId: reward.itemId,
        quantity: reward.quantity ?? 1,
        reason,
        questSlug,
      },
    });
  }
  for (const [trait, delta] of Object.entries(rewards.traits ?? {})) {
    events.push({
      key: `${keyPrefix}:trait:${trait}`,
      payload: { type: "trait.changed", trait, delta, reason, questSlug },
    });
  }
  for (const [tendency, delta] of Object.entries(rewards.tendencies ?? {})) {
    events.push({
      key: `${keyPrefix}:tendency:${tendency}`,
      payload: {
        type: "tendency.changed",
        tendency,
        delta,
        reason,
        questSlug,
      },
    });
  }
  for (const slug of rewards.unlocks ?? []) {
    if (save.world.unlockedQuests.includes(slug)) continue;
    events.push({
      key: `${keyPrefix}:unlock:${slug}`,
      payload: {
        type: "quest.unlocked",
        slug,
        reason: `${reason}:${questSlug}`,
      },
    });
  }
  for (const achievementId of rewards.achievements ?? []) {
    if (save.player.achievements[achievementId]) continue;
    events.push({
      key: `${keyPrefix}:achievement:${achievementId}`,
      payload: {
        type: "achievement.unlocked",
        achievementId,
        reason: `${reason}:${questSlug}`,
      },
    });
  }
  for (const locationId of rewards.locations ?? []) {
    if (save.world.discoveredLocations.includes(locationId)) continue;
    events.push({
      key: `${keyPrefix}:location:${locationId}`,
      payload: {
        type: "location.discovered",
        locationId,
        reason: `${reason}:${questSlug}`,
      },
    });
  }
  for (const secretId of rewards.secrets ?? []) {
    if (save.world.secrets.includes(secretId)) continue;
    events.push({
      key: `${keyPrefix}:secret:${secretId}`,
      payload: {
        type: "secret.found",
        secretId,
        reason: `${reason}:${questSlug}`,
      },
    });
  }
  if (rewards.playerName && save.player.name !== rewards.playerName)
    events.push({
      key: `${keyPrefix}:playerName`,
      payload: { type: "player.renamed", name: rewards.playerName },
    });
  if (rewards.companion && !save.player.companions[rewards.companion.id])
    events.push({
      key: `${keyPrefix}:companion`,
      payload: {
        type: "companion.registered",
        id: rewards.companion.id,
        name: rewards.companion.name,
        species: rewards.companion.species,
        reason,
        questSlug,
      },
    });
  for (const [companionId, amount] of Object.entries(
    rewards.companionXp ?? {},
  )) {
    if (!amount) continue;
    events.push({
      key: `${keyPrefix}:companionXp:${companionId}`,
      payload: {
        type: "companion.xpGained",
        companionId,
        amount,
        reason,
        questSlug,
      },
    });
  }
  for (const system of rewards.unlockSystems ?? []) {
    if (save.world.unlockedSystems.includes(system)) continue;
    events.push({
      key: `${keyPrefix}:system:${system}`,
      payload: {
        type: "system.unlocked",
        system,
        reason: `${reason}:${questSlug}`,
      },
    });
  }
  return events;
};

// Rewards for finishing a quest. First-completion rewards are keyed by
// slug so a replayed completion can never grant them twice; repeatable
// quests get a fresh key per completion.
const rewardEvents = (
  save: SaveFile,
  quest: QuestDefinition,
  completionIndex: number,
): NewGameEvent[] =>
  rewardsToEvents(
    save,
    quest.rewards,
    quest.repeatable
      ? `quest:${quest.slug}:${completionIndex}`
      : `quest:${quest.slug}`,
    "quest_complete",
    quest.slug,
  );

// Condition-based achievements the resulting save now earns.
const achievementEvents = (
  save: SaveFile,
  events: NewGameEvent[],
  at: string,
): NewGameEvent[] =>
  newlyEarnedAchievements(simulate(save, events, at)).map((achievementId) => ({
    key: `achievement:${achievementId}`,
    payload: {
      type: "achievement.unlocked" as const,
      achievementId,
      reason: "condition",
    },
  }));

export const handleCommand = (
  save: SaveFile,
  command: Command,
  at = new Date().toISOString(),
): CommandResult => {
  switch (command.type) {
    case "quest.start": {
      const quest = getQuest(command.slug);
      if (!quest)
        return reject("unknown-quest", `No such quest: ${command.slug}`);
      if (quest.status === "coming-soon")
        return reject("coming-soon", `${quest.title} isn't ready yet`);
      const gate = canStartQuest(save, quest);
      if (!gate.ok)
        return reject("locked", `${quest.title} is locked`, gate.missing);
      if (
        save.quests[command.slug]?.startedAt &&
        !hasCompleted(save, command.slug)
      )
        return { ok: true, events: [] };
      return {
        ok: true,
        events: [{ payload: { type: "quest.started", slug: command.slug } }],
      };
    }

    case "quest.progress": {
      const quest = getQuest(command.slug);
      if (!quest)
        return reject("unknown-quest", `No such quest: ${command.slug}`);
      const gate = canStartQuest(save, quest);
      if (!gate.ok)
        return reject("locked", `${quest.title} is locked`, gate.missing);
      if (command.step < 0 || command.step > quest.steps.length)
        return reject("bad-step", `Step ${command.step} is out of range`);
      return {
        ok: true,
        events: [
          {
            payload: {
              type: "quest.progressed",
              slug: command.slug,
              step: command.step,
              answers: command.answers,
              unlockedSteps: command.unlockedSteps,
            },
          },
        ],
      };
    }

    case "quest.complete": {
      const quest = getQuest(command.slug);
      if (!quest)
        return reject("unknown-quest", `No such quest: ${command.slug}`);
      const gate = canStartQuest(save, quest);
      if (!gate.ok)
        return reject("locked", `${quest.title} is locked`, gate.missing);
      const alreadyDone = hasCompleted(save, command.slug);
      if (alreadyDone && !quest.repeatable)
        return reject(
          "already-completed",
          `${quest.title} is already complete`,
        );
      const completionIndex = (save.quests[command.slug]?.completions ?? 0) + 1;
      const events: NewGameEvent[] = [
        {
          payload: {
            type: "quest.completed",
            slug: command.slug,
            answers: command.answers,
          },
        },
        ...rewardEvents(save, quest, completionIndex),
      ];
      return {
        ok: true,
        events: [...events, ...achievementEvents(save, events, at)],
      };
    }

    case "item.consume": {
      if (!command.operationId || command.operationId.length > 100)
        return reject("bad-operation", "operationId is required");
      if (
        !Number.isInteger(command.quantity) ||
        command.quantity < 1 ||
        command.quantity > 99
      )
        return reject("bad-quantity", "quantity must be 1–99");
      const check = canConsume(save, command.itemId, command.quantity);
      if (!check.ok) return reject(check.code, check.message);
      const events: NewGameEvent[] = [
        {
          key: `consume:${command.operationId}`,
          payload: {
            type: "item.consumed",
            itemId: command.itemId,
            quantity: command.quantity,
            reason: command.reason,
            questSlug: command.questSlug,
          },
        },
      ];
      return {
        ok: true,
        events: [...events, ...achievementEvents(save, events, at)],
      };
    }

    case "item.equip": {
      if (!command.operationId || command.operationId.length > 100)
        return reject("bad-operation", "operationId is required");
      const check = canEquip(save, command.ownerId, command.itemId);
      if (!check.ok) return reject(check.code, check.message);
      const events: NewGameEvent[] = [
        {
          key: `equip:${command.operationId}`,
          payload: {
            type: "item.equipped",
            ownerId: command.ownerId,
            itemId: command.itemId,
            reason: command.reason,
          },
        },
      ];
      return {
        ok: true,
        events: [...events, ...achievementEvents(save, events, at)],
      };
    }

    case "item.unequip": {
      if (!command.operationId || command.operationId.length > 100)
        return reject("bad-operation", "operationId is required");
      const check = canUnequip(save, command.ownerId, command.itemId);
      if (!check.ok) return reject(check.code, check.message);
      const events: NewGameEvent[] = [
        {
          key: `unequip:${command.operationId}`,
          payload: {
            type: "item.unequipped",
            ownerId: command.ownerId,
            itemId: command.itemId,
            reason: "player",
          },
        },
      ];
      return {
        ok: true,
        events: [...events, ...achievementEvents(save, events, at)],
      };
    }

    case "encounter.complete": {
      if (!command.operationId || command.operationId.length > 100)
        return reject("bad-operation", "operationId is required");
      const quest = getQuest(command.questSlug);
      if (!quest)
        return reject("unknown-quest", `No such quest: ${command.questSlug}`);
      const gate = canStartQuest(save, quest);
      if (!gate.ok)
        return reject("locked", `${quest.title} is locked`, gate.missing);
      const step = quest.steps.find(
        (candidate) => candidate.id === command.stepId,
      );
      if (
        !step ||
        step.type !== "encounter" ||
        step.encounterId !== command.encounterId
      )
        return reject(
          "bad-step",
          `${quest.title} has no encounter step ${command.stepId}`,
        );
      const encounter = getEncounter(command.encounterId);
      if (!encounter)
        return reject(
          "unknown-encounter",
          `No such encounter: ${command.encounterId}`,
        );
      if (
        !Number.isFinite(command.score) ||
        command.score < 0 ||
        command.score > encounter.maxScore
      )
        return reject("bad-score", `score must be 0–${encounter.maxScore}`);
      const plays = save.player.encounters?.[command.encounterId]?.plays ?? 0;
      const keyPrefix = encounter.repeatableRewards
        ? `encounter:${quest.slug}:${step.id}:${plays + 1}`
        : `encounter:${quest.slug}:${step.id}`;
      const events: NewGameEvent[] = [
        {
          key: `encounter:${command.operationId}`,
          payload: {
            type: "encounter.completed",
            encounterId: command.encounterId,
            questSlug: quest.slug,
            stepId: step.id,
            score: command.score,
            reward: command.reward,
          },
        },
        ...rewardsToEvents(
          save,
          encounter.rewards({ score: command.score, reward: command.reward }),
          keyPrefix,
          "encounter",
          quest.slug,
        ),
      ];
      return {
        ok: true,
        events: [...events, ...achievementEvents(save, events, at)],
      };
    }

    case "grants.accept": {
      const pending = new Set(pendingGrants(save).map((grant) => grant.key));
      const grantKeys = command.grantKeys.filter((key) => pending.has(key));
      if (grantKeys.length === 0) return { ok: true, events: [] };
      const events: NewGameEvent[] = [
        { payload: { type: "grants.accepted", grantKeys } },
      ];
      return {
        ok: true,
        events: [...events, ...achievementEvents(save, events, at)],
      };
    }

    default: {
      const _exhaustive: never = command;
      return reject("unknown-command", "Unknown command");
    }
  }
};
