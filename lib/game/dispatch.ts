// The single entry point for world events, whatever transport they came
// in on: run the engine against the freshest save and commit the result.
// Browsers find out by reading state again (polling today); nothing is
// pushed from here.
//
// Wired up in the route handler; `run` is passed in so this file doesn't
// import the database.

import { describeWorldEvent } from "./commands";
import type { CommandOutcome } from "./store";
import type { GameEvent, PlayerId, WorldEvent } from "./types";

type Deps = {
  // Resolves only after the resulting events are committed.
  run: (event: WorldEvent, playerId: PlayerId) => Promise<CommandOutcome>;
  playerId: PlayerId;
};

export type WorldEventResult = {
  changed: boolean;
  // Slugs of quests whose saved progress the event changed.
  quests: string[];
};

const questsTouched = (applied: GameEvent[]) => [
  ...new Set(
    applied.flatMap((event) =>
      event.payload.type === "quest.stepUnlocked" ? [event.payload.slug] : [],
    ),
  ),
];

export const createWorldEventDispatcher =
  ({ run, playerId }: Deps) =>
  async (event: WorldEvent): Promise<WorldEventResult> => {
    const outcome = await run(event, playerId);
    const applied = outcome.ok ? outcome.applied : [];
    const quests = questsTouched(applied);
    console.info(
      `[Game] handled ${describeWorldEvent(event)} → ${applied.length} event(s)`,
    );
    for (const slug of quests) console.info(`[Game] updated quest ${slug}`);
    return { changed: applied.length > 0, quests };
  };

export type WorldEventDispatcher = ReturnType<
  typeof createWorldEventDispatcher
>;
