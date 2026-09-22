"use client";

import { Link } from "react-router-dom";
import { ArrowLeft, Backpack, Sparkles } from "lucide-react";
import { useGame } from "@/app/game-provider";
import type { InventoryView } from "@/lib/game/view";
import { inventoryIcons } from "./icons";
import { Shell } from "./shell";

const sections: { kind: InventoryView["kind"]; title: string; eyebrow: string }[] = [
  { kind: "quest-item", title: "Quest Items", eyebrow: "Tied to the story" },
  { kind: "trinket", title: "Trinkets", eyebrow: "Handy to have" },
  { kind: "keepsake", title: "Keepsakes", eyebrow: "Yours to keep" },
];

function ItemGrid({ items }: { items: InventoryView[] }) {
  return (
    <div className="item-grid">
      {items.map((item) => {
        const Icon = inventoryIcons[item.icon] || Sparkles;
        const unlocked = item.quantity > 0;
        return (
          <article
            className={`item-slot ${unlocked ? "is-unlocked" : "is-locked"}`}
            key={item.id}
            style={
              {
                "--item-color": item.color,
                "--item-tilt": item.tilt,
              } as React.CSSProperties
            }
          >
            <div className="item-well">
              {unlocked ? (
                <Icon aria-hidden="true" />
              ) : (
                <span aria-hidden="true">?</span>
              )}
              {unlocked && <b>×{item.quantity}</b>}
            </div>
            <h3>{unlocked ? item.name : "Unknown object"}</h3>
            <p>{unlocked ? item.description : item.unlockHint}</p>
          </article>
        );
      })}
    </div>
  );
}

export function Inventory() {
  const { view, error } = useGame();
  const inventory = view?.inventory ?? null;
  const inventoryError = Boolean(error);
  const unlockedItems =
    inventory?.filter((item) => item.quantity > 0).length || 0;

  return (
    <Shell>
      <main className="profile-page relative z-10 mx-auto max-w-6xl px-5 pb-20">
        <Link to="/lobby" className="back-link">
          <ArrowLeft /> Back to lobby
        </Link>
        <div className="page-title">
          <p className="eyebrow">Field pack</p>
          <h1>Inventory</h1>
          <span>
            {inventory
              ? `${unlockedItems} / ${inventory.length} items found`
              : "Syncing pack…"}
          </span>
        </div>

        {inventory &&
          sections.map((section) => {
            const items = inventory.filter(
              (item) => item.kind === section.kind,
            );
            if (items.length === 0) return null;
            return (
              <section
                aria-labelledby={`inventory-${section.kind}-title`}
                className="profile-section inventory-section"
                key={section.kind}
              >
                <div className="profile-section-heading">
                  <div>
                    <p className="eyebrow">{section.eyebrow}</p>
                    <h2 id={`inventory-${section.kind}-title`}>
                      {section.title}
                    </h2>
                  </div>
                  <span>
                    {items.filter((item) => item.quantity > 0).length} /{" "}
                    {items.length} found
                  </span>
                </div>
                <div className="field-pack">
                  <ItemGrid items={items} />
                </div>
              </section>
            );
          })}

        {!inventory && !inventoryError && (
          <div className="inventory-sync" role="status">
            <div className="loading-spinner">
              <span />
              <span />
              <span />
              <span />
            </div>
            <p>Syncing field pack…</p>
          </div>
        )}
        {inventoryError && (
          <div className="inventory-sync is-error">
            <Backpack aria-hidden="true" />
            <p>Field pack connection lost.</p>
          </div>
        )}
      </main>
    </Shell>
  );
}
