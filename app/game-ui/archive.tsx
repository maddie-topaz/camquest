"use client";

import { Link } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import { quests } from "@/lib/game/content/quests";
import { useGame } from "@/app/game-provider";
import { Shell } from "./shell";

export function Archive() {
  const { view } = useGame();
  return (
    <Shell>
      <main className="relative z-10 mx-auto max-w-4xl px-5 pb-16">
        <Link to="/lobby" className="back-link">
          <ArrowLeft /> Back to lobby
        </Link>
        <div className="page-title">
          <p className="eyebrow">The archive</p>
          <h1>Completed quests</h1>
        </div>
        <div className="archive-list">
          {quests.map((a) => {
            const questView = view?.quests[a.slug];
            const completed = questView?.status === "completed";
            const completedDate =
              questView?.completedAt &&
              new Date(questView.completedAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              });
            return (
              <div className="archive-row" key={a.id}>
                <span className="archive-symbol">{a.symbol}</span>
                <div className="archive-row-body">
                  <h2>{a.title}</h2>
                  <div className="archive-row-meta">
                    <p>
                      {completed
                        ? completedDate
                          ? `Completed ${completedDate}`
                          : "Completed"
                        : a.status === "coming-soon"
                          ? "The ink is still drying."
                          : "Waiting to be discovered."}
                    </p>
                    {completed && (
                      <Link
                        className="card-link"
                        to={`/quest/${a.slug}/complete`}
                      >
                        View result <Check className="text-[#f0b8d2]" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </Shell>
  );
}
