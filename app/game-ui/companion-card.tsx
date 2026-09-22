"use client";

import { PawPrint, Sparkles } from "lucide-react";
import type { CompanionView } from "@/lib/game/view";
import { companionIcons, inventoryIcons } from "./icons";

// Generic — renders whatever's in `view.companions`. No Kitana-specific
// UI here; a second companion registered by a future quest gets the same
// card for free.
export function CompanionCard({ companion }: { companion: CompanionView }) {
  const Icon = companionIcons[companion.icon] || PawPrint;
  return (
    <article
      className="companion-card"
      style={{ "--item-color": companion.color } as React.CSSProperties}
    >
      <div className="companion-avatar" aria-hidden="true">
        <Icon aria-hidden="true" />
      </div>
      <div className="companion-identity">
        <p className="eyebrow">
          Companion • {companion.companionClass}
        </p>
        <h3>{companion.name}</h3>
        {companion.title && (
          <p className="companion-title">{companion.title}</p>
        )}
      </div>
      <div className="companion-level">
        <span>Level</span>
        <strong>{String(companion.level.level).padStart(2, "0")}</strong>
        <small>
          {companion.level.xp - companion.level.floor} /{" "}
          {companion.level.ceiling - companion.level.floor} XP
        </small>
        <div className="level-meter">
          <i
            style={{ width: `${Math.round(companion.level.fraction * 100)}%` }}
          />
        </div>
      </div>
      {companion.stats.length > 0 && (
        <div className="companion-stats trait-list">
          {companion.stats.map((stat) => (
            <div className="trait-row" key={stat.id}>
              <span>{stat.name}</span>
              <div
                className="trait-meter"
                role="meter"
                aria-valuemin={0}
                aria-valuemax={stat.max}
                aria-valuenow={stat.value}
                aria-label={stat.name}
              >
                <i style={{ width: `${(stat.value / stat.max) * 100}%` }} />
              </div>
              <strong>{stat.value}</strong>
            </div>
          ))}
        </div>
      )}
      <div className="companion-equipment">
        <p className="companion-equipment-label">Equipment</p>
        {companion.equipped.length > 0 ? (
          <ul className="companion-equipment-list">
            {companion.equipped.map((equipped) => {
              const EquippedIcon = inventoryIcons[equipped.icon] || Sparkles;
              return (
                <li key={equipped.itemId} style={{ "--item-color": equipped.color } as React.CSSProperties}>
                  <EquippedIcon aria-hidden="true" />
                  {equipped.name}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="companion-equipment-empty">Nothing equipped yet.</p>
        )}
      </div>
    </article>
  );
}
