// Signal Lock: a needle sweeps the dial; tap (or press space) when it
// crosses the glowing window. Five sweeps, the window narrows and the
// needle speeds up each time. Score per sweep is 0–100 by how centred the
// lock was; the encounter definition turns the total into rewards.

import Phaser from "phaser";
import { emitCue } from "../audio/bus";
import type { EncounterResult } from "../content/encounters";
import type { EncounterRuntime } from "../machines/encounter";

const WIDTH = 640;
const HEIGHT = 400;
const ROUNDS = 5;
const TRACK_LEFT = 70;
const TRACK_RIGHT = WIDTH - 70;
const TRACK_Y = 210;

const PINK = 0xff5fbd;
const CYAN = 0x55e7ff;
const INK = 0x100b27;

const FONT = { fontFamily: '"Courier New", monospace', color: "#f7f0ff" };

class SignalLockScene extends Phaser.Scene {
  private onComplete: (result: EncounterResult) => void;
  private round = 0;
  private total = 0;
  private needleX = TRACK_LEFT;
  private direction = 1;
  private speed = 260;
  private windowCentre = WIDTH / 2;
  private windowHalf = 60;
  private sweeping = false;
  private needle!: Phaser.GameObjects.Rectangle;
  private windowZone!: Phaser.GameObjects.Rectangle;
  private roundText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private feedback!: Phaser.GameObjects.Text;

  constructor(onComplete: (result: EncounterResult) => void) {
    super("signal-lock");
    this.onComplete = onComplete;
  }

  create() {
    this.cameras.main.setBackgroundColor(INK);

    // Dial track and tick marks.
    const g = this.add.graphics();
    g.lineStyle(3, 0x7f58c9, 1);
    g.strokeRoundedRect(
      TRACK_LEFT - 20,
      TRACK_Y - 34,
      TRACK_RIGHT - TRACK_LEFT + 40,
      68,
      8,
    );
    g.lineStyle(1, 0x3b2a69, 1);
    for (let x = TRACK_LEFT; x <= TRACK_RIGHT; x += 25)
      g.lineBetween(x, TRACK_Y + 22, x, TRACK_Y + 30);

    this.windowZone = this.add
      .rectangle(
        this.windowCentre,
        TRACK_Y,
        this.windowHalf * 2,
        56,
        CYAN,
        0.28,
      )
      .setStrokeStyle(2, CYAN, 0.9);
    this.needle = this.add.rectangle(this.needleX, TRACK_Y, 6, 76, PINK);
    this.tweens.add({
      targets: this.windowZone,
      alpha: { from: 0.7, to: 1 },
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    this.add
      .text(WIDTH / 2, 48, "SIGNAL LOCK", {
        ...FONT,
        fontSize: "30px",
        fontStyle: "bold",
        color: "#ff5fbd",
      })
      .setOrigin(0.5);
    this.add
      .text(WIDTH / 2, 84, "TAP WHEN THE NEEDLE CROSSES THE GLOW", {
        ...FONT,
        fontSize: "12px",
        color: "#c0b7d0",
      })
      .setOrigin(0.5);
    this.roundText = this.add.text(TRACK_LEFT - 20, 130, "", {
      ...FONT,
      fontSize: "14px",
      color: "#55e7ff",
    });
    this.scoreText = this.add
      .text(TRACK_RIGHT + 20, 130, "", {
        ...FONT,
        fontSize: "14px",
        color: "#ffd166",
      })
      .setOrigin(1, 0);
    this.feedback = this.add
      .text(WIDTH / 2, 300, "", {
        ...FONT,
        fontSize: "22px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.input.on("pointerdown", () => this.lock());
    this.input.keyboard?.on("keydown-SPACE", () => this.lock());

    emitCue("encounter-start");
    this.startRound();
  }

  update(_time: number, delta: number) {
    if (!this.sweeping) return;
    this.needleX += (this.direction * this.speed * delta) / 1000;
    if (this.needleX >= TRACK_RIGHT) {
      this.needleX = TRACK_RIGHT;
      this.direction = -1;
    }
    if (this.needleX <= TRACK_LEFT) {
      this.needleX = TRACK_LEFT;
      this.direction = 1;
    }
    this.needle.x = this.needleX;
  }

  private startRound() {
    this.round += 1;
    // Narrower window, faster needle, new position each sweep.
    this.windowHalf = Math.max(18, 60 - (this.round - 1) * 10);
    this.speed = 260 + (this.round - 1) * 70;
    this.windowCentre = Phaser.Math.Between(
      TRACK_LEFT + this.windowHalf + 30,
      TRACK_RIGHT - this.windowHalf - 30,
    );
    this.windowZone
      .setPosition(this.windowCentre, TRACK_Y)
      .setSize(this.windowHalf * 2, 56);
    this.needleX = this.direction === 1 ? TRACK_LEFT : TRACK_RIGHT;
    this.roundText.setText(`SWEEP ${this.round} / ${ROUNDS}`);
    this.scoreText.setText(`SCORE ${this.total}`);
    this.feedback.setText("");
    this.sweeping = true;
  }

  private lock() {
    if (!this.sweeping) return;
    this.sweeping = false;
    const distance = Math.abs(this.needleX - this.windowCentre);
    const points =
      distance <= this.windowHalf
        ? Math.round(100 * (1 - distance / this.windowHalf))
        : 0;
    this.total += points;
    emitCue(points > 0 ? "encounter-hit" : "encounter-miss", { points });
    this.scoreText.setText(`SCORE ${this.total}`);
    this.feedback
      .setText(points >= 90 ? "PERFECT" : points > 0 ? `+${points}` : "MISS")
      .setColor(points >= 90 ? "#ffd166" : points > 0 ? "#55e7ff" : "#ff5fbd");
    this.cameras.main.flash(
      120,
      points > 0 ? 85 : 255,
      points > 0 ? 231 : 95,
      points > 0 ? 255 : 189,
      false,
    );

    if (this.round >= ROUNDS) {
      this.time.delayedCall(700, () => this.finish());
    } else {
      this.time.delayedCall(700, () => this.startRound());
    }
  }

  private finish() {
    emitCue("encounter-complete", { score: this.total });
    const banner = this.add.rectangle(
      WIDTH / 2,
      HEIGHT / 2,
      WIDTH,
      120,
      INK,
      0.92,
    );
    const text = this.add
      .text(
        WIDTH / 2,
        HEIGHT / 2,
        `LOCKED  ·  ${this.total} / ${ROUNDS * 100}`,
        { ...FONT, fontSize: "28px", fontStyle: "bold", color: "#ffd166" },
      )
      .setOrigin(0.5);
    this.tweens.add({
      targets: [banner, text],
      alpha: { from: 0, to: 1 },
      duration: 300,
    });
    this.tweens.add({
      targets: text,
      scale: { from: 1, to: 1.06 },
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
    this.time.delayedCall(1400, () => this.onComplete({ score: this.total }));
  }
}

export const runtime: EncounterRuntime = {
  mount: (container, onComplete) => {
    let completed = false;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      width: WIDTH,
      height: HEIGHT,
      backgroundColor: "#100b27",
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: new SignalLockScene((result) => {
        if (completed) return;
        completed = true;
        onComplete(result);
      }),
    });
    return () => game.destroy(true);
  },
};
