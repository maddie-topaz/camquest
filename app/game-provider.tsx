"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useActorRef, useSelector } from "@xstate/react";
import {
  adminAction,
  loadSave,
  sendCommand,
  type SaveView,
} from "@/lib/game/client";
import { playerMachine } from "@/lib/game/machines/player";
import type { Command } from "@/lib/game/types";

// One save for the whole app, driven by the player machine: it loads the
// view once and runs commands strictly one after another. Screens read
// `view` and change it only through `dispatch` (rule-checked) or `admin`
// (debug page); both resolve with what the server returned, so the UI
// never drifts from the database.
type GameContextValue = {
  view: SaveView | null;
  error: unknown;
  loading: boolean;
  syncing: boolean;
  // Resolves with the current view, waiting for the initial load if it
  // hasn't finished. The START screen awaits this during the boot animation.
  load: () => Promise<SaveView>;
  refresh: () => Promise<SaveView>;
  dispatch: (command: Command) => Promise<SaveView>;
  admin: (body: Record<string, unknown>) => Promise<SaveView>;
};

const GameContext = createContext<GameContextValue | null>(null);

let jobCounter = 0;
const nextJobId = () => `job:${Date.now().toString(36)}:${(jobCounter += 1)}`;

export function GameProvider({ children }: { children: React.ReactNode }) {
  const actor = useActorRef(playerMachine, {
    input: {
      load: loadSave,
      run: async (command) => (await sendCommand(command)).view,
      admin: async (body) => (await adminAction(body)).view,
    },
  });
  const view = useSelector(actor, (snapshot) => snapshot.context.view);
  const error = useSelector(actor, (snapshot) =>
    snapshot.matches("failed") ? snapshot.context.error : null,
  );
  const loading = useSelector(actor, (snapshot) => snapshot.matches("loading"));
  const syncing = useSelector(
    actor,
    (snapshot) =>
      snapshot.matches("syncing") || snapshot.context.queue.length > 0,
  );

  // Turns a queued job back into a promise by waiting for the machine to
  // emit its result under the id we queued it with.
  const enqueue = useCallback(
    (
      event:
        | { type: "COMMAND"; command: Command }
        | { type: "ADMIN"; body: Record<string, unknown> },
    ) =>
      new Promise<SaveView>((resolve, reject) => {
        const id = nextJobId();
        const done = actor.on("job.done", (emitted) => {
          if (emitted.id !== id) return;
          done.unsubscribe();
          failed.unsubscribe();
          resolve(emitted.view);
        });
        const failed = actor.on("job.failed", (emitted) => {
          if (emitted.id !== id) return;
          done.unsubscribe();
          failed.unsubscribe();
          reject(emitted.error);
        });
        actor.send({ ...event, id });
      }),
    [actor],
  );

  const dispatch = useCallback(
    (command: Command) => enqueue({ type: "COMMAND", command }),
    [enqueue],
  );
  const admin = useCallback(
    (body: Record<string, unknown>) => enqueue({ type: "ADMIN", body }),
    [enqueue],
  );

  const load = useCallback(
    () =>
      new Promise<SaveView>((resolve, reject) => {
        const snapshot = actor.getSnapshot();
        if (snapshot.context.view) return resolve(snapshot.context.view);
        if (snapshot.matches("failed")) actor.send({ type: "RETRY" });
        const subscription = actor.subscribe((next) => {
          if (next.context.view) {
            subscription.unsubscribe();
            resolve(next.context.view);
          } else if (next.matches("failed")) {
            subscription.unsubscribe();
            reject(
              next.context.error instanceof Error
                ? next.context.error
                : new Error("Failed to load save"),
            );
          }
        });
      }),
    [actor],
  );

  const refresh = useCallback(() => {
    actor.send({ type: "LOAD" });
    return load();
  }, [actor, load]);

  const value = useMemo<GameContextValue>(
    () => ({ view, error, loading, syncing, load, refresh, dispatch, admin }),
    [view, error, loading, syncing, load, refresh, dispatch, admin],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) throw new Error("useGame must be used inside GameProvider");
  return context;
};
