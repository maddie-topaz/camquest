"use client";

import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Backpack,
  KeyRound,
  MapPin,
  Trophy,
  Zap,
} from "lucide-react";
import { quests } from "@/lib/game/content/quests";
import { traits as traitDefinitions } from "@/lib/game/content/traits";
import { tendencies as tendencyDefinitions } from "@/lib/game/content/tendencies";
import { useGame } from "@/app/game-provider";
import { accentStyle } from "./colors";
import { CompanionCard } from "./companion-card";
import { achievementIcons, tendencyIcons, traitIcons } from "./icons";
import { Shell } from "./shell";

// A level-derived flavor rank — display only, no save state of its own.
const playerTitle = (level: number) => {
  if (level >= 10) return "Legend";
  if (level >= 7) return "Veteran";
  if (level >= 4) return "Regular";
  return "Newcomer";
};

// Flavor text for Cam's card. Static, like the rest of his identity —
// there's only one Cam, so this doesn't need a content file the way
// companion bios do.
const CAM_BIO =
  "A quietly capable adventurer who prefers experience over instructions, with good rhythm and even better instincts. If there is a strange signal, hidden door, or unnecessary detour, he will eventually find it.";

export function Profile() {
  const { view, error } = useGame();
  const save = view?.save;
  const questStates = view ? Object.values(view.quests) : [];
  const totalQuests = quests.length;
  const clearedQuests = questStates.filter(
    (state) => state.status === "completed",
  ).length;
  const decisionsMade = save
    ? Object.values(save.quests).reduce(
        (total, quest) => total + Object.keys(quest.answers).length,
        0,
      )
    : 0;
  const locationsDiscovered = save?.world.discoveredLocations.length ?? 0;
  const secretsFound = save?.world.secrets.length ?? 0;
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
  const tendencyRows = tendencyDefinitions.map((tendency) => ({
    ...tendency,
    value: save?.player.tendencies[tendency.id] ?? tendency.initial,
  }));
  const unlockedItems =
    inventory?.filter((item) => item.quantity > 0).length || 0;
  const unlockedAchievements = achievements.filter(
    (item) => item.unlocked,
  ).length;

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
                <p className="player-title">{playerTitle(level.level)}</p>
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
              <p className="player-bio">{CAM_BIO}</p>
            </div>
            {companions[0] && <CompanionCard companion={companions[0]} />}
          </div>
        </section>

        <div className="stats-traits-grid">
          <section aria-labelledby="player-stats-title" className="dial-section">
            <div className="profile-section-heading">
              <div>
                <p className="eyebrow">Run data</p>
                <h2 id="player-stats-title">Player stats</h2>
              </div>
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
                <MapPin aria-hidden="true" />
                <span>Locations discovered</span>
                <strong>{locationsDiscovered}</strong>
              </article>
              <article className="stat-card">
                <Backpack aria-hidden="true" />
                <span>Items found</span>
                <strong>{unlockedItems}</strong>
              </article>
              <article className="stat-card">
                <KeyRound aria-hidden="true" />
                <span>Secrets found</span>
                <strong>{secretsFound}</strong>
              </article>
            </div>
          </section>

          <section aria-labelledby="traits-title" className="dial-section">
            <div className="profile-section-heading">
              <div>
                <p className="eyebrow">Abilities</p>
                <h2 id="traits-title">Traits</h2>
              </div>
            </div>
            <div className="trait-list">
              {traitRows.map((trait) => {
                const Icon = traitIcons[trait.icon];
                return (
                  <div
                    className="trait-row"
                    key={trait.id}
                    title={trait.description}
                    style={accentStyle(trait.color)}
                  >
                    <span className="trait-label">
                      {Icon && <Icon aria-hidden="true" />}
                      {trait.name}
                    </span>
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
                );
              })}
            </div>
          </section>

          <section aria-labelledby="tendencies-title" className="dial-section">
            <div className="profile-section-heading">
              <div>
                <p className="eyebrow">Calibration</p>
                <h2 id="tendencies-title">Tendencies</h2>
              </div>
            </div>
            <div className="trait-list">
              {tendencyRows.map((tendency) => {
                const Icon = tendencyIcons[tendency.icon];
                return (
                  <div
                    className="trait-row"
                    key={tendency.id}
                    title={tendency.description}
                    style={accentStyle(tendency.color)}
                  >
                    <span className="trait-label">
                      {Icon && <Icon aria-hidden="true" />}
                      {tendency.name}
                    </span>
                    <div
                      className="trait-meter"
                      role="meter"
                      aria-valuemin={tendency.min}
                      aria-valuemax={tendency.max}
                      aria-valuenow={tendency.value}
                      aria-label={tendency.name}
                    >
                      <i
                        style={{
                          width: `${((tendency.value - tendency.min) / (tendency.max - tendency.min)) * 100}%`,
                        }}
                      />
                    </div>
                    <strong>{tendency.value}</strong>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <section
          aria-labelledby="achievements-title"
          className="profile-section achievements-section dial-section"
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
          className="profile-section inventory-section dial-section"
        >
          <div className="profile-section-heading">
            <div>
              <p className="eyebrow">Collected loot</p>
              <h2 id="inventory-title">Inventory</h2>
            </div>
          </div>
          <div className="inventory-preview-card">
            <span>
              {inventory
                ? `${unlockedItems} / ${inventory.length} items found`
                : inventoryError
                  ? "Field pack connection lost."
                  : "Syncing pack…"}
            </span>
            <Link className="card-link" to="/inventory">
              <Backpack aria-hidden="true" /> View Inventory <ArrowRight />
            </Link>
          </div>
        </section>
      </main>
    </Shell>
  );
}
