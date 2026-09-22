"use client";

import { useCallback, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { useActorRef, useSelector } from "@xstate/react";
import { useGame } from "@/app/game-provider";
import { EncounterStage } from "@/app/encounter-stage";
import { emitCue } from "@/lib/game/audio/bus";
import { CommandRejectedError } from "@/lib/game/client";
import type { EncounterResult } from "@/lib/game/content/encounters";
import type { QuestDefinition } from "@/lib/game/content/quests";
import { questMachine, questSelectors } from "@/lib/game/machines/quest";
import { choiceIcons } from "./icons";
import { describeRequirements } from "./requirements";
import { Shell } from "./shell";
import { ChallengeBody, EncounterResultCard } from "./quest-step";

export function Challenge({ quest }: { quest: QuestDefinition }) {
  const { view } = useGame();
  if (!view)
    return (
      <Shell>
        <main className="relative z-10 mx-auto max-w-3xl px-5 pb-20">
          <div className="inventory-sync" role="status">
            <div className="loading-spinner">
              <span />
              <span />
              <span />
              <span />
            </div>
            <p>Loading save…</p>
          </div>
        </main>
      </Shell>
    );
  // Keyed on the slug so switching quests starts a fresh machine.
  return <ChallengeRun key={quest.slug} quest={quest} view={view} />;
}

function ChallengeRun({
  quest,
  view,
}: {
  quest: QuestDefinition;
  view: NonNullable<ReturnType<typeof useGame>["view"]>;
}) {
  const navigate = useNavigate();
  const { dispatch } = useGame();

  // Quest play is a state machine (lib/game/machines/quest). It owns which
  // step we're on and what's answered; this component renders it and
  // turns its emitted `progress` / `complete` events into commands.
  const actor = useActorRef(questMachine, {
    input: {
      quest: quest,
      save: view.save,
      saved: view.save.quests[quest.slug],
      completed: view.quests[quest.slug]?.status === "completed",
    },
  });
  const snapshot = useSelector(actor, (state) => state);
  const { stepIndex, answer, passcodeInput, passcodeError, missing } =
    snapshot.context;
  const step = questSelectors.step(snapshot);

  useEffect(() => {
    void dispatch({ type: "quest.start", slug: quest.slug }).catch((error) =>
      console.error("Failed to start quest", error),
    );
    const progress = actor.on("progress", (event) => {
      void dispatch({
        type: "quest.progress",
        slug: quest.slug,
        ...event.progress,
      }).catch((error) =>
        console.error("Failed to save quest progress", error),
      );
    });
    const cues = actor.on("cue", (event) => emitCue(event.cue, event.detail));
    const complete = actor.on("complete", (event) => {
      // The engine records the completion, pays out rewards, and unlocks
      // whatever this quest unlocks, all in one transaction.
      dispatch({
        type: "quest.complete",
        slug: quest.slug,
        answers: event.answers,
      })
        .then(() => actor.send({ type: "COMPLETED" }))
        .catch((error) => {
          if (error instanceof CommandRejectedError)
            console.warn("Completion not recorded:", error.rejection.message);
          else console.error("Failed to save quest completion", error);
          actor.send({ type: "COMPLETION_FAILED" });
        });
      navigate(`/quest/${quest.slug}/complete`);
    });
    return () => {
      progress.unsubscribe();
      cues.unsubscribe();
      complete.unsubscribe();
    };
  }, [actor, quest.slug, dispatch, navigate]);

  if (snapshot.matches("locked")) {
    return (
      <Shell>
        <main className="relative z-10 mx-auto max-w-3xl px-5 pb-20">
          <Link to="/quest-log" className="back-link">
            <ArrowLeft /> Back to quest log
          </Link>
          <div className="challenge-panel">
            <p className="eyebrow">Signal locked</p>
            <h1>{quest.title}</h1>
            <p className="challenge-prompt">{describeRequirements(missing)}</p>
          </div>
        </main>
      </Shell>
    );
  }
  if (!step) return null;

  // The mini-game reported back: record it (rewards are paid server-side)
  // then let the machine turn the step over.
  const onEncounterResult = useCallback(
    (result: EncounterResult) => {
      if (step?.type !== "encounter") return;
      dispatch({
        type: "encounter.complete",
        questSlug: quest.slug,
        stepId: step.id,
        encounterId: step.encounterId,
        score: result.score,
        reward: result.reward,
        operationId: crypto.randomUUID(),
      })
        .catch((error) => {
          if (error instanceof CommandRejectedError)
            console.warn("Encounter not recorded:", error.rejection.message);
          else console.error("Failed to record encounter", error);
        })
        .finally(() =>
          actor.send({
            type: "ENCOUNTER_RESULT",
            score: result.score,
            reward: result.reward,
          }),
        );
    },
    [actor, quest.slug, dispatch, step],
  );

  const isGated = questSelectors.isGated(snapshot);
  const revealed = questSelectors.isRevealed(snapshot);
  const selectedCard = questSelectors.selectedCard(snapshot);
  const showingOutcome =
    step.type === "mystery" && revealed && Boolean(selectedCard);
  const primaryLabel = questSelectors.primaryLabel(snapshot);
  const primaryDisabled = questSelectors.primaryDisabled(snapshot);
  const primaryAction = () =>
    actor.send({
      type: step.type === "mystery" && !revealed ? "REVEAL" : "NEXT",
    });
  const OutcomeIcon =
    selectedCard &&
    ((selectedCard.icon && choiceIcons[selectedCard.icon]) || Sparkles);

  return (
    <Shell>
      <main className="relative z-10 mx-auto max-w-3xl px-5 pb-20">
        <div className="progress-line">
          <span>
            Round {stepIndex + 1} of {quest.steps.length}
          </span>
          <div>
            <i
              style={{
                width: `${((stepIndex + 1) / quest.steps.length) * 100}%`,
              }}
            />
          </div>
        </div>
        <div className="challenge-panel">
          <p className="eyebrow">{step.type} challenge</p>
          <h1>{step.title}</h1>
          <div className="challenge-prompt">
            {step.prompt.split("\n\n").map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          {isGated ? (
            <div className="riddle-box passcode-gate">
              <p className="eyebrow">Checkpoint synchronization required</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  actor.send({ type: "SUBMIT_PASSCODE" });
                }}
              >
                <input
                  id="passcode"
                  aria-label="Passcode"
                  value={passcodeInput}
                  onChange={(e) =>
                    actor.send({ type: "TYPE_PASSCODE", value: e.target.value })
                  }
                  placeholder="Enter code"
                  autoComplete="off"
                />
                {passcodeError && (
                  <p className="passcode-error">
                    That code doesn't match. Try again.
                  </p>
                )}
                <button type="submit" className="portal-button mt-4">
                  Sync <ArrowRight />
                </button>
              </form>
            </div>
          ) : showingOutcome && selectedCard ? (
            <div className="reveal-box outcome-reveal">
              <span className="mystery-mark">
                {OutcomeIcon && <OutcomeIcon aria-hidden="true" />}
              </span>
              <strong>{selectedCard.label}</strong>
              <p>{selectedCard.outcome}</p>
            </div>
          ) : step.type === "encounter" && revealed ? (
            <EncounterResultCard
              encounterId={step.encounterId}
              score={Number(answer)}
            />
          ) : step.type === "encounter" ? (
            <EncounterStage
              encounterId={step.encounterId}
              onResult={onEncounterResult}
            />
          ) : (
            <ChallengeBody
              step={step}
              answer={answer}
              setAnswer={(value) => actor.send({ type: "TYPE_ANSWER", value })}
              selectAnswer={(value) => actor.send({ type: "SELECT", value })}
              revealed={revealed}
              setRevealed={() => actor.send({ type: "REVEAL" })}
            />
          )}
          {!isGated && questSelectors.showsPrimary(snapshot) && (
            <button
              className="portal-button mt-8"
              disabled={primaryDisabled}
              onClick={primaryAction}
            >
              {primaryLabel} <ArrowRight />
            </button>
          )}
        </div>
      </main>
    </Shell>
  );
}
