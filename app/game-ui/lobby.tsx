"use client";

import { Link } from "react-router-dom";
import {
  Archive as ArchiveIcon,
  ArrowRight,
  Gamepad2,
  UserRound,
} from "lucide-react";
import { Shell } from "./shell";

const lobbyDestinations = [
  {
    to: "/quest-log",
    icon: Gamepad2,
    title: "Quest log",
    description: "See your current quests.",
    linkLabel: "Enter quest log",
  },
  {
    to: "/archive",
    icon: ArchiveIcon,
    title: "Archive",
    description: "See completed quests.",
    linkLabel: "Open archive",
  },
  {
    to: "/profile",
    icon: UserRound,
    title: "Player profile",
    description: "Check your stats and collected loot.",
    linkLabel: "View player profile",
  },
];
export function Lobby() {
  return (
    <Shell>
      <main className="relative z-10 mx-auto max-w-6xl px-5 pb-16">
        <div className="page-title">
          <p className="eyebrow">Cam⚡Quest</p>
          <h1>Game lobby</h1>
        </div>
        <div className="quest-grid">
          {lobbyDestinations.map((dest) => {
            const Icon = dest.icon;
            return (
              <Link key={dest.to} className="quest-card" to={dest.to}>
                <div className="card-top">
                  <span className="quest-symbol">
                    <Icon aria-hidden="true" />
                  </span>
                </div>
                <h3>{dest.title}</h3>
                <p>{dest.description}</p>
                <span className="card-link">
                  {dest.linkLabel} <ArrowRight />
                </span>
              </Link>
            );
          })}
        </div>
      </main>
    </Shell>
  );
}
