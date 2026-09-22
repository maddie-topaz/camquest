"use client";

import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Backpack,
  CircleDot,
  Gamepad2,
  Trophy,
  Zap,
} from "lucide-react";
import { quests } from "@/lib/game/content/quests";
import { traits as traitDefinitions } from "@/lib/game/content/traits";
import { START_UNLOCK_ID } from "@/lib/game/machines/quest";
import { useGame } from "@/app/game-provider";
import { CompanionCard } from "./companion-card";
import { achievementIcons } from "./icons";
import { Shell } from "./shell";

export function Profile() {
  const { view, error } = useGame();
  const save = view?.save;
  const questStates = view ? Object.values(view.quests) : [];
  const totalQuests = quests.length;
  const clearedQuests = questStates.filter(
    (state) => state.status === "completed",
  ).length;
  const availableQuests = quests.filter(
    (quest) => quest.status !== "coming-soon",
  ).length;
  const decisionsMade = save
    ? Object.values(save.quests).reduce(
        (total, quest) => total + Object.keys(quest.answers).length,
        0,
      )
    : 0;
  const checkpointsFound = save
    ? Object.values(save.quests).reduce(
        (total, quest) =>
          total +
          quest.unlockedSteps.filter((step) => step !== START_UNLOCK_ID).length,
        0,
      )
    : 0;
  const completionRate = availableQuests
    ? Math.round((clearedQuests / availableQuests) * 100)
    : 0;
  const level = view?.level ?? {
    level: 1,
    xp: 0,
    floor: 0,
    ceiling: 100,
    fraction: 0,
  };
  const playerName = save?.player.name || "Player Two";
  const companions = view?.companions ?? [];
  const inventory = view?.inventory ?? null;
  const inventoryError = Boolean(error);

  // Achievements are defined in lib/game/content/achievements and unlocked
  // by the rules engine; the profile only renders them.
  const achievements = (view?.achievements ?? []).map((achievement) => ({
    id: achievement.id,
    name: achievement.name,
    detail: achievement.description,
    icon: achievementIcons[achievement.icon] || Trophy,
    unlocked: Boolean(achievement.unlockedAt),
  }));
  const traitRows = traitDefinitions.map((trait) => ({
    ...trait,
    value: save?.player.traits[trait.id] ?? trait.initial,
  }));
  const unlockedItems =
    inventory?.filter((item) => item.quantity > 0).length || 0;
  const unlockedAchievements = achievements.filter(
    (item) => item.unlocked,
  ).length;
  const latestClear = questStates
    .map((state) => state.completedAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  return (
    <Shell>
      <main className="profile-page relative z-10 mx-auto max-w-6xl px-5 pb-20">
        <Link to="/lobby" className="back-link">
          <ArrowLeft /> Back to lobby
        </Link>
        <section
          aria-labelledby="party-title"
          className="profile-section party-section"
        >
          <div className="profile-section-heading">
            <div>
              <p className="eyebrow">Profile</p>
              <h2 id="party-title">Player Profile</h2>
            </div>
          </div>
          <div className={`party-grid ${companions.length === 0 ? "is-solo" : ""}`}>
            <div className="profile-hero">
              <div className="player-avatar" aria-hidden="true">
                <span>C</span>
                <i />
              </div>
              <div className="player-identity">
                <p className="eyebrow">Player</p>
                <h1>{playerName}</h1>
                <p>
                  <span className="online-dot" /> Ready for quest
                </p>
              </div>
              <div className="player-level">
                <span>Level</span>
                <strong>{String(level.level).padStart(2, "0")}</strong>
                <small>
                  {level.xp - level.floor} / {level.ceiling - level.floor} XP
                </small>
                <div className="level-meter">
                  <i
                    style={{ width: `${Math.round(level.fraction * 100)}%` }}
                  />
                </div>
              </div>
            </div>
            {companions[0] && <CompanionCard companion={companions[0]} />}
          </div>
        </section>

        <div className="stats-traits-grid">
          <section aria-labelledby="player-stats-title">
            <div className="profile-section-heading">
              <div>
                <p className="eyebrow">Run data</p>
                <h2 id="player-stats-title">Player stats</h2>
              </div>
              {latestClear && (
                <span>
                  Last clear{" "}
                  {new Date(latestClear).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              )}
            </div>
            <div className="stats-grid">
              <article className="stat-card">
                <Trophy aria-hidden="true" />
                <span>Quests cleared</span>
                <strong>
                  {clearedQuests}
                  <small> / {totalQuests}</small>
                </strong>
              </article>
              <article className="stat-card">
                <Zap aria-hidden="true" />
                <span>Decisions made</span>
                <strong>{decisionsMade}</strong>
              </article>
              <article className="stat-card">
                <CircleDot aria-hidden="true" />
                <span>Checkpoints found</span>
                <strong>{checkpointsFound}</strong>
              </article>
              <article className="stat-card">
                <Gamepad2 aria-hidden="true" />
                <span>Completion</span>
                <strong>
                  {completionRate}
                  <small>%</small>
                </strong>
              </article>
            </div>
          </section>

          <section aria-labelledby="traits-title">
            <div className="profile-section-heading">
              <div>
                <p className="eyebrow">Calibration</p>
                <h2 id="traits-title">Traits</h2>
              </div>
              <span>Shaped by every choice</span>
            </div>
            <div className="trait-list">
              {traitRows.map((trait) => (
                <div
                  className="trait-row"
                  key={trait.id}
                  title={trait.description}
                >
                  <span>{trait.name}</span>
                  <div
                    className="trait-meter"
                    role="meter"
                    aria-valuemin={trait.min}
                    aria-valuemax={trait.max}
                    aria-valuenow={trait.value}
                    aria-label={trait.name}
                  >
                    <i
                      style={{
                        width: `${((trait.value - trait.min) / (trait.max - trait.min)) * 100}%`,
                      }}
                    />
                  </div>
                  <strong>{trait.value}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section
          aria-labelledby="achievements-title"
          className="profile-section achievements-section"
        >
          <div className="profile-section-heading">
            <div>
              <p className="eyebrow">Milestones</p>
              <h2 id="achievements-title">Achievements</h2>
            </div>
            <span>
              {unlockedAchievements} / {achievements.length} unlocked
            </span>
          </div>
          <div className="inventory-grid achievements-grid">
            {achievements.map((item) => {
              const Icon = item.icon;
              return (
                <article
                  className={`inventory-slot achievement-card ${item.unlocked ? "is-unlocked" : "is-locked"}`}
                  key={item.id}
                >
                  <div className="inventory-icon">
                    <Icon aria-hidden="true" />
                  </div>
                  <div>
                    <h3>{item.name}</h3>
                    <p>{item.detail}</p>
                  </div>
                  <span>{item.unlocked ? "Unlocked" : "Locked"}</span>
                </article>
              );
            })}
          </div>
        </section>

        <section
          aria-labelledby="inventory-title"
          className="profile-section inventory-section"
        >
          <div className="profile-section-heading">
            <div>
              <p className="eyebrow">Collected loot</p>
              <h2 id="inventory-title">Inventory</h2>
            </div>
            <span>
              {inventory
                ? `${unlockedItems} / ${inventory.length} items found`
                : "Syncing pack…"}
            </span>
          </div>
          <Link className="card-link" to="/inventory">
            <Backpack aria-hidden="true" /> Open field pack <ArrowRight />
          </Link>
        </section>
      </main>
    </Shell>
  );
}
