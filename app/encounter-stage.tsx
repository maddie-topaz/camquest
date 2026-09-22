"use client";

import { useEffect, useRef } from "react";
import { useActorRef, useSelector } from "@xstate/react";
import { loadEncounterRuntime } from "@/lib/game/encounters";
import { encounterMachine } from "@/lib/game/machines/encounter";
import type { EncounterResult } from "@/lib/game/content/encounters";

// Mounts a Phaser encounter for exactly as long as it is on screen. The
// machine loads the scene module on demand, runs it inside `stage`, and
// hands the result up once; unmounting this component (or the machine
// finishing) destroys the game.
export function EncounterStage({
  encounterId,
  onResult,
}: {
  encounterId: string;
  onResult: (result: EncounterResult) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const actor = useActorRef(encounterMachine, {
    input: {
      encounterId,
      getContainer: () => stage.current,
      load: loadEncounterRuntime,
    },
  });
  const state = useSelector(actor, (snapshot) =>
    snapshot.matches("loading")
      ? "loading"
      : snapshot.matches("playing")
        ? "playing"
        : snapshot.matches("failed")
          ? "failed"
          : "finished",
  );
  const error = useSelector(actor, (snapshot) => snapshot.context.error);

  useEffect(() => {
    const subscription = actor.on("result", (event) => onResult(event.result));
    return () => subscription.unsubscribe();
  }, [actor, onResult]);

  return (
    <div className={`encounter-stage is-${state}`} data-encounter={encounterId}>
      <div
        ref={stage}
        className="encounter-canvas"
        aria-label="Encounter"
        role="application"
      />
      {state === "loading" && (
        <div className="encounter-overlay" role="status">
          <div className="loading-spinner">
            <span />
            <span />
            <span />
            <span />
          </div>
          <p>Tuning in…</p>
        </div>
      )}
      {state === "failed" && (
        <div className="encounter-overlay is-error">
          <p>The signal wouldn't come through.</p>
          {error instanceof Error && <small>{error.message}</small>}
          <button
            className="portal-button"
            onClick={() => actor.send({ type: "RETRY" })}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
