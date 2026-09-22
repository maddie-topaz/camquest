"use client";

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useGame } from "@/app/game-provider";
import type { QuestDefinition } from "@/lib/game/content/quests";
import { choiceIcons } from "./icons";
import { Shell } from "./shell";

export function Completion({ quest }: { quest: QuestDefinition }) {
  // The save is the only source of truth for a finished quest's choices.
  // `undefined` means the save is still loading; `null` means it loaded
  // but this quest has never been completed.
  const { view, error } = useGame();
  const questView = view?.quests[quest.slug];
  const answers: Record<string, string> | null | undefined =
    !view && !error
      ? undefined
      : questView && questView.completions > 0
        ? view!.save.quests[quest.slug].answers
        : null;

  const loading = answers === undefined;

  const outcomes = useMemo(
    () =>
      quest.steps.flatMap((step) => {
        if (step.type !== "mystery") return [];
        const selected = step.cards.find(
          (card) => card.label === answers?.[step.id],
        );
        return selected?.outcome
          ? [
              {
                choice: selected.label,
                outcome: selected.outcome,
                icon: selected.icon && choiceIcons[selected.icon],
                tags: selected.tags,
              },
            ]
          : [];
      }),
    [quest.steps, answers],
  );

  const summaryRows = useMemo(
    () =>
      quest.steps.flatMap((step) => {
        if (step.type !== "mystery" || !step.summaryLabel) return [];
        const selected = step.cards.find(
          (card) => card.label === answers?.[step.id],
        );
        const value = selected?.summaryValue || selected?.label;
        return value ? [{ label: step.summaryLabel, value }] : [];
      }),
    [quest.steps, answers],
  );

  const diceBasedCount = useMemo(
    () =>
      outcomes.filter((result) => result.tags?.includes("dice-based")).length,
    [outcomes],
  );

  return (
    <Shell>
      <main className="relative z-10 mx-auto max-w-3xl px-5 pb-20">
        <div className="completion-panel">
          <div className="completion-star">✦</div>
          <p className="eyebrow">Quest complete</p>
          <h1>{quest.completionTitle || "Quest complete"}</h1>
          <p className="challenge-prompt">{quest.completionMessage}</p>
          {quest.reward && (
            <div className="final-note glitch-text">{quest.reward}</div>
          )}
          {loading ? (
            <div className="loading-block" role="status" aria-live="polite">
              <div className="loading-spinner">
                <span />
                <span />
                <span />
                <span />
              </div>
              <p className="loading-label">Loading your Saturday…</p>
            </div>
          ) : (
            outcomes.length > 0 && (
              <>
                <div className="outcome-list">
                  {outcomes.map((result) => {
                    const Icon = result.icon;
                    return (
                      <div className="outcome-stop" key={result.choice}>
                        <span className="outcome-icon">
                          {Icon ? (
                            <Icon aria-hidden="true" />
                          ) : (
                            <Sparkles aria-hidden="true" />
                          )}
                        </span>
                        <div>
                          <span className="outcome-label">{result.choice}</span>
                          <strong>{result.outcome}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="run-summary-heading">Run summary</p>
                <div className="run-summary">
                  {quest.companionName && (
                    <div className="run-summary-row">
                      <span>Player 2</span>
                      <strong>{quest.companionName}</strong>
                    </div>
                  )}
                  <div className="run-summary-row">
                    <span>Quest</span>
                    <strong>{quest.title}</strong>
                  </div>
                  <div className="run-summary-row">
                    <span>Status</span>
                    <strong>Cleared</strong>
                  </div>
                  {summaryRows.map((row) => (
                    <div className="run-summary-row" key={row.label}>
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                    </div>
                  ))}
                </div>
                <p className="run-summary-heading">Game stats</p>
                <div className="run-summary">
                  <div className="run-summary-row">
                    <span>Decisions survived</span>
                    <strong>{outcomes.length}</strong>
                  </div>
                  <div className="run-summary-row">
                    <span>Dice-based decisions</span>
                    <strong>{diceBasedCount}</strong>
                  </div>
                  {quest.funStats?.map((stat) => (
                    <div className="run-summary-row" key={stat.label}>
                      <span>{stat.label}</span>
                      <strong>{stat.value}</strong>
                    </div>
                  ))}
                </div>
              </>
            )
          )}
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            <Link className="portal-button" to="/lobby">
              Return to lobby
            </Link>
            <Link className="secondary-button" to="/archive">
              View archive
            </Link>
          </div>
        </div>
      </main>
    </Shell>
  );
}
