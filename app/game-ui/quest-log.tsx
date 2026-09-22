"use client";

import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import { quests, type QuestDefinition } from "@/lib/game/content/quests";
import { useGame } from "@/app/game-provider";
import type { QuestView } from "@/lib/game/client";
import { describeRequirements } from "./requirements";
import { Shell } from "./shell";

export function QuestLog() {
  const { view } = useGame();
  return (
    <Shell>
      <main className="relative z-10 mx-auto max-w-6xl px-5 pb-16">
        <Link to="/lobby" className="back-link">
          <ArrowLeft /> Back to lobby
        </Link>
        <div className="page-title">
          <p className="eyebrow">Cam⚡Quest</p>
          <h1>Quest log</h1>
        </div>
        <div className="quest-grid">
          {quests.map((quest) => (
            <QuestCard
              key={quest.id}
              quest={quest}
              questView={view?.quests[quest.slug]}
            />
          ))}
        </div>
      </main>
    </Shell>
  );
}
function QuestCard({
  quest,
  questView,
}: {
  quest: QuestDefinition;
  questView?: QuestView;
}) {
  // Status comes from the save via the rules engine; 'coming-soon' is the
  // one authoring flag that overrides it.
  const comingSoon = quest.status === "coming-soon";
  const status = questView?.status ?? "available";
  const locked = comingSoon || status === "locked";
  const completed = status === "completed";
  const pill = completed
    ? "Completed"
    : status === "locked"
      ? "Locked"
      : comingSoon
        ? "Coming soon"
        : status === "in-progress"
          ? "In progress"
          : "Available";
  return (
    <article className={`quest-card ${locked ? "is-locked" : ""}`}>
      <div className="card-top">
        <span className="quest-symbol">
          {locked ? <Lock aria-hidden="true" /> : quest.symbol}
        </span>
        <span className="status-pill">{pill}</span>
      </div>
      <h3>{quest.title}</h3>
      <p>{quest.description}</p>
      {status === "locked" && questView ? (
        <span className="card-link muted">
          {describeRequirements(questView.missing)}
        </span>
      ) : comingSoon ? (
        <span className="card-link muted">Still being written</span>
      ) : completed ? (
        <Link className="card-link" to={`/quest/${quest.slug}/complete`}>
          View result <ArrowRight />
        </Link>
      ) : (
        <Link className="card-link" to={`/quest/${quest.slug}`}>
          {status === "in-progress" ? "Continue quest" : "Start quest"}{" "}
          <ArrowRight />
        </Link>
      )}
    </article>
  );
}
