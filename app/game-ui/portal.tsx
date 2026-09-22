"use client";

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Backpack, Sparkles } from "lucide-react";
import { useActorRef, useSelector } from "@xstate/react";
import { useGame } from "@/app/game-provider";
import { emitCue } from "@/lib/game/audio/bus";
import { startMachine, startSelectors } from "@/lib/game/machines/start";
import { inventoryIcons } from "./icons";
import { Shell } from "./shell";

export function Portal() {
  const navigate = useNavigate();
  const game = useGame();
  const acceptButton = useRef<HTMLButtonElement>(null);
  const [interactive, setInteractive] = useState(false);

  // Server-rendered HTML can arrive before the client bundle. Only offer
  // START once hydration has attached the handler and started the actor.
  useEffect(() => setInteractive(true), []);

  // The reveal ceremony is a state machine (lib/game/machines/start);
  // this component only renders its state and forwards its emitted sound
  // cues and the final "enter" to the outside world.
  const actor = useActorRef(startMachine, {
    input: {
      load: game.load,
      accept: (grantKeys) =>
        game.dispatch({ type: "grants.accept", grantKeys }),
    },
  });
  const phase = useSelector(actor, (snapshot) =>
    snapshot.matches("idle")
      ? "idle"
      : snapshot.matches("booting") || snapshot.matches("deciding")
        ? "transition"
        : snapshot.matches("revealing")
          ? "revealing"
          : snapshot.matches("ready")
            ? "ready"
            : snapshot.matches("accepting")
              ? "accepting"
              : snapshot.matches("error")
                ? "error"
                : "leaving",
  );
  const pendingItems = useSelector(actor, (snapshot) => snapshot.context.items);
  const isFirstGrant = startSelectors.isFirstGrant(pendingItems);

  useEffect(() => {
    const cues = actor.on("cue", (event) => emitCue(event.cue, event.detail));
    const enter = actor.on("enter", () => navigate("/quest-log"));
    return () => {
      cues.unsubscribe();
      enter.unsubscribe();
    };
  }, [actor, navigate]);

  useEffect(() => {
    if (phase !== "revealing") return;
    // Per-card flourishes, timed to the CSS reveal.
    const timers = pendingItems.map((item, index) =>
      window.setTimeout(
        () => emitCue("item-acquired", { itemId: item.itemId, index }),
        900 + index * 650,
      ),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [phase, pendingItems]);

  useEffect(() => {
    if (phase === "ready") acceptButton.current?.focus();
  }, [phase]);

  const startGame = () => actor.send({ type: "START" });
  const acceptItems = () => actor.send({ type: "ACCEPT" });

  return (
    <Shell minimal>
      <main
        className={`arcade-home ${phase !== "idle" ? "is-starting" : ""}`}
        data-start-phase={phase}
      >
        <section className="portal-hero">
          <div className="arcade-machine" aria-label="Camquest arcade machine">
            <button
              type="button"
              className="arcade-screen"
              onClick={startGame}
              disabled={!interactive || phase !== "idle"}
              aria-busy={!interactive}
              aria-label="Start Camquest"
            >
              <span className="screen-scanlines" aria-hidden="true" />
              <span className="pixel-sprite sprite-heart" aria-hidden="true">
                ♥
              </span>
              <span className="screen-stars">✦ · ✦ · ✦</span>
              <strong>CAM⚡QUEST</strong>
              <span className="screen-subtitle">
                READY UP. ADVENTURE CALLS.
              </span>
              <span className="screen-prompt" aria-live="polite">
                {interactive ? "[ START GAME ]" : "[ LOADING GAME… ]"}
              </span>
            </button>
            <div
              className="arcade-controls"
              aria-label="Two-player arcade controls"
            >
              <div className="player-controls" aria-label="Player one buttons">
                <div className="arcade-buttons">
                  <button type="button" aria-label="Player one pink button">
                    <span />
                  </button>
                  <button type="button" aria-label="Player one gold button">
                    <span />
                  </button>
                </div>
              </div>
              <div
                className="player-controls player-two"
                aria-label="Player two buttons"
              >
                <div className="arcade-buttons">
                  <button type="button" aria-label="Player two cyan button">
                    <span />
                  </button>
                  <button type="button" aria-label="Player two violet button">
                    <span />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
        {phase !== "idle" && (
          <div
            className={`inventory-reveal-overlay phase-${phase}`}
            role="dialog"
            aria-modal="true"
            aria-label="Starting inventory"
            data-sfx="inventory-sequence"
          >
            <span className="reveal-scanlines" aria-hidden="true" />
            {phase === "transition" && (
              <div className="inventory-boot" role="status" aria-live="polite">
                <span className="boot-rune">✦</span>
                <p>Initialising player inventory...</p>
                <div>
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <small>Synchronising field pack // Player 02</small>
              </div>
            )}
            {phase === "error" && (
              <div className="inventory-boot inventory-boot-error">
                <span className="boot-rune">!</span>
                <p>Inventory signal lost</p>
                <small>The field pack could not be synchronised.</small>
                <button
                  className="portal-button"
                  onClick={() => actor.send({ type: "RETRY" })}
                >
                  Retry link
                </button>
              </div>
            )}
            {(phase === "revealing" ||
              phase === "ready" ||
              phase === "accepting" ||
              phase === "leaving") && (
              <section className="starter-inventory-panel">
                <span className="fantasy-corner corner-one" aria-hidden="true">
                  ✦
                </span>
                <span className="fantasy-corner corner-two" aria-hidden="true">
                  ✦
                </span>
                <div className="starter-heading">
                  <p>
                    {isFirstGrant
                      ? "System grant // New player cache"
                      : "Incoming transfer // Field pack update"}
                  </p>
                  <h1 id="inventory-reveal-title">
                    {isFirstGrant
                      ? "Starting inventory loaded"
                      : "New items received"}
                  </h1>
                  <span>
                    {isFirstGrant
                      ? "These objects are now bound to Player 02."
                      : "Someone left these for Player 02."}
                  </span>
                </div>
                <div className="starter-pack-rail">
                  <Backpack aria-hidden="true" />
                  <span>Field pack</span>
                  <small>
                    {pendingItems.length}{" "}
                    {pendingItems.length === 1 ? "object" : "objects"} received
                  </small>
                </div>
                <div className="starter-item-grid">
                  {pendingItems.map((item, index) => {
                    const Icon = inventoryIcons[item.icon] || Sparkles;
                    return (
                      <article
                        className="starter-item"
                        key={item.itemId}
                        style={
                          {
                            "--reveal-delay": `${0.8 + index * 0.65}s`,
                            "--item-color": item.color,
                            "--item-tilt": item.tilt,
                          } as React.CSSProperties
                        }
                        data-sfx="item-acquired"
                      >
                        <div className="starter-item-object">
                          <span className="item-burst" aria-hidden="true" />
                          <Icon aria-hidden="true" />
                          <b>×{item.quantity}</b>
                        </div>
                        <h2>{item.name}</h2>
                        <p>{item.description}</p>
                      </article>
                    );
                  })}
                </div>
                <button
                  ref={acceptButton}
                  className="accept-items-button"
                  disabled={phase !== "ready"}
                  onClick={acceptItems}
                  data-sfx="inventory-accepted"
                >
                  {phase === "ready"
                    ? "Accept items"
                    : phase === "accepting"
                      ? "Binding items..."
                      : "Loading items..."}{" "}
                  <ArrowRight aria-hidden="true" />
                </button>
              </section>
            )}
          </div>
        )}
      </main>
    </Shell>
  );
}
