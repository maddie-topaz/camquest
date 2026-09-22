"use client";

import { BookOpen, Sparkles, Zap } from "lucide-react";
import { useGame } from "@/app/game-provider";
import { getEncounter } from "@/lib/game/content/encounters";
import type { ChallengeStep } from "@/lib/game/content/quests";
import { choiceIcons } from "./icons";

export function EncounterResultCard({
  encounterId,
  score,
}: {
  encounterId: string;
  score: number;
}) {
  const encounter = getEncounter(encounterId);
  const { view } = useGame();
  const record = view?.encounters.find((entry) => entry.id === encounterId);
  return (
    <div className="reveal-box outcome-reveal encounter-result">
      <span className="mystery-mark">
        <Zap aria-hidden="true" />
      </span>
      <strong>{encounter?.rank?.({ score }) ?? "Locked"}</strong>
      <p>
        {score} / {encounter?.maxScore ?? "?"}
        {record && record.bestScore > score
          ? ` · best ${record.bestScore}`
          : record && record.plays > 1
            ? " · new best"
            : ""}
      </p>
    </div>
  );
}
export function ChallengeBody({
  step,
  answer,
  setAnswer,
  selectAnswer,
  revealed,
  setRevealed,
}: {
  step: ChallengeStep;
  answer: string;
  setAnswer: (v: string) => void;
  selectAnswer: (v: string) => void;
  revealed: boolean;
  setRevealed: (v: boolean) => void;
}) {
  if (step.type === "choice")
    return (
      <div className="option-grid">
        {step.options.map((option) => (
          <button
            key={option}
            className={`choice ${answer === option ? "selected" : ""}`}
            aria-pressed={answer === option}
            onClick={() => selectAnswer(option)}
          >
            {option}
            <span>{answer === option ? "Selected" : "Choose"}</span>
          </button>
        ))}
      </div>
    );
  if (step.type === "mystery")
    return (
      <div className="option-grid mystery-grid">
        {step.cards.map((card) => {
          const selected = answer === card.label;
          const Icon = (card.icon && choiceIcons[card.icon]) || Sparkles;
          return (
            <button
              key={card.label}
              className={`mystery-card ${selected ? "selected" : ""}`}
              aria-pressed={selected}
              onClick={() => selectAnswer(card.label)}
            >
              <span className="mystery-mark">
                <Icon aria-hidden="true" />
              </span>
              <strong>{card.label}</strong>
            </button>
          );
        })}
      </div>
    );
  if (step.type === "riddle")
    return (
      <div className="riddle-box">
        <p>{step.clue}</p>
        <label htmlFor="answer">Your answer</label>
        <input
          id="answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Type what you think..."
        />
      </div>
    );
  if (step.type === "reveal")
    return (
      <div className="reveal-box">
        <Sparkles />
        <p>{step.message}</p>
      </div>
    );
  return (
    <div className="confirm-box">
      <BookOpen />
      <p>{step.type === "activity" ? step.detail : step.prompt}</p>
      {step.type === "confirm" && (
        <button className="text-button" onClick={() => setRevealed(true)}>
          {step.button}
        </button>
      )}
    </div>
  );
}
