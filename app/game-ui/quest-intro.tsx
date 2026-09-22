"use client";

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useGame } from "@/app/game-provider";
import { emitCue } from "@/lib/game/audio/bus";
import type { QuestDefinition } from "@/lib/game/content/quests";
import { START_UNLOCK_ID } from "@/lib/game/machines/quest";
import { Shell } from "./shell";

const startUnlockId = START_UNLOCK_ID;
export function Intro({ quest }: { quest: QuestDefinition }) {
  const navigate = useNavigate();
  const { view, dispatch } = useGame();
  const paragraphs = (quest.introduction || "").split("\n\n");
  const [startPasscodeInput, setStartPasscodeInput] = useState("");
  const [startPasscodeError, setStartPasscodeError] = useState(false);
  const saved = view?.save.quests[quest.slug];
  const startUnlocked =
    !quest.startPasscode ||
    Boolean(saved?.unlockedSteps.includes(startUnlockId));

  const unlockStart = async () => {
    const target = quest.startPasscode?.trim().toUpperCase();
    if (target && startPasscodeInput.trim().toUpperCase() === target) {
      setStartPasscodeError(false);
      emitCue("checkpoint-unlocked");
      try {
        await dispatch({ type: "quest.start", slug: quest.slug });
        await dispatch({
          type: "quest.progress",
          slug: quest.slug,
          step: saved?.step ?? 0,
          answers: saved?.answers ?? {},
          unlockedSteps: [...(saved?.unlockedSteps ?? []), startUnlockId],
        });
      } catch (error) {
        console.error("Failed to unlock quest start", error);
        setStartPasscodeError(true);
      }
    } else {
      setStartPasscodeError(true);
      emitCue("checkpoint-denied");
    }
  };

  return (
    <Shell>
      <main className="relative z-10 mx-auto max-w-3xl px-5 pb-20">
        <Link to="/lobby" className="back-link">
          <ArrowLeft /> Back to lobby
        </Link>
        <div className="intro-panel transmission-panel">
          <span
            className="big-symbol transmission-line"
            style={{ animationDelay: ".1s" }}
          >
            {quest.symbol}
          </span>
          <p
            className="eyebrow transmission-line"
            style={{ animationDelay: ".25s" }}
          >
            A mysterious challenger has appeared...
          </p>
          <h1 className="transmission-line" style={{ animationDelay: ".4s" }}>
            {quest.title}
          </h1>
          {quest.subtitle && (
            <p
              className="intro-subtitle transmission-line"
              style={{ animationDelay: ".55s" }}
            >
              {quest.subtitle}
            </p>
          )}
          <div
            className="story-text transmission-line"
            style={{ animationDelay: ".7s" }}
          >
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          {startUnlocked ? (
            <button
              className="portal-button transmission-line"
              style={{ animationDelay: "1s" }}
              onClick={() => navigate(`/quest/${quest.slug}/play`)}
            >
              {quest.ctaLabel || "Begin quest"} <ArrowRight />
            </button>
          ) : (
            <div
              className="riddle-box passcode-gate transmission-line"
              style={{ animationDelay: "1s" }}
            >
              <p className="eyebrow">Checkpoint synchronization required</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void unlockStart();
                }}
              >
                <input
                  id="start-passcode"
                  aria-label="Passcode"
                  value={startPasscodeInput}
                  onChange={(e) => {
                    setStartPasscodeInput(e.target.value);
                    setStartPasscodeError(false);
                  }}
                  placeholder="Enter code"
                  autoComplete="off"
                />
                {startPasscodeError && (
                  <p className="passcode-error">
                    That code doesn't match. Try again.
                  </p>
                )}
                <button type="submit" className="portal-button mt-4">
                  Sync <ArrowRight />
                </button>
              </form>
            </div>
          )}
        </div>
      </main>
    </Shell>
  );
}
