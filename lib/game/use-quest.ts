"use client";

// One quest's authoritative state, as a hook. Components render whatever
// this returns and never fetch quest state themselves, so swapping polling
// for a push-driven invalidation later only touches this file.

import { useQuery } from "@tanstack/react-query";
import type { QuestDefinition } from "./content/quests";
import { questQuery } from "./queries";

export const QUEST_POLL_INTERVAL_MS = 1500;

// A quest with a step that opens on a world event (a terminal press, a
// beacon) can change while nobody touches this tab. Those are the only
// quests worth polling.
export const hasExternalObjectives = (quest: QuestDefinition) =>
  quest.steps.some((step) => Boolean(step.trigger));

export const useQuest = (slug: string, { poll = false } = {}) =>
  useQuery({
    ...questQuery(slug),
    // Polls only while the calling screen is mounted and asks for it;
    // TanStack pauses it while the tab is hidden.
    refetchInterval: poll ? QUEST_POLL_INTERVAL_MS : false,
    // Coming back to the tab refetches straight away rather than waiting
    // for the next interval tick.
    refetchOnWindowFocus: poll ? "always" : true,
  });
