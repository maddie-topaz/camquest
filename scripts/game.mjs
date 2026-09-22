// Admin CLI for the save file. Talks to the running app so every change
// goes through the same engine and event log as the UI.
//
// Usage (dev server on :3000 by default; set CAMQUEST_URL to override):
//   node scripts/game.mjs status
//   node scripts/game.mjs events [limit]
//   node scripts/game.mjs grant <itemId> [quantity] [reason]
//   node scripts/game.mjs xp <amount> [reason]
//   node scripts/game.mjs trait <trait> <delta> [reason]
//   node scripts/game.mjs unlock <questSlug>
//   node scripts/game.mjs reset-quest <questSlug>
//   node scripts/game.mjs rearm
//
// Item, trait and quest ids come from lib/game/content.

const base = (process.env.CAMQUEST_URL || "http://localhost:3000").replace(/\/$/, "");

const usage = () => {
  console.error(`Usage:
  game.mjs status
  game.mjs events [limit=30]
  game.mjs grant <itemId> [quantity=1] [reason=gift]
  game.mjs xp <amount> [reason=admin]
  game.mjs trait <trait> <delta> [reason=admin]
  game.mjs unlock <questSlug>
  game.mjs reset-quest <questSlug>
  game.mjs rearm`);
  process.exitCode = 1;
};

const request = async (path, init) => {
  const response = await fetch(base + path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || data?.rejection?.message || `${response.status} ${response.statusText}`);
  return data;
};

const printStatus = (view) => {
  const { save, level } = view;
  console.log(`${save.player.name}  level ${level.level}  ${save.player.xp} XP  (seq ${save.seq})`);
  console.log("traits:", Object.entries(save.player.traits).map(([k, v]) => `${k}=${v}`).join("  "));
  console.log("pack:");
  for (const item of view.inventory) {
    const pending = view.pendingGrants.filter((g) => g.itemId === item.id).length;
    console.log(`  ${item.id.padEnd(20)} x${String(item.quantity).padEnd(3)}${pending ? ` (${pending} pending accept)` : ""}`);
  }
  console.log("quests:");
  for (const quest of Object.values(view.quests)) {
    const missing = Object.keys(quest.missing).length ? `  missing ${JSON.stringify(quest.missing)}` : "";
    console.log(`  ${quest.slug.padEnd(20)} ${quest.status}${quest.completions ? ` ×${quest.completions}` : ""}${missing}`);
  }
  const earned = view.achievements.filter((a) => a.unlockedAt).map((a) => a.id);
  console.log("achievements:", earned.length ? earned.join(", ") : "none yet");
  console.log("world:", JSON.stringify(save.world));
};

const admin = async (body) => {
  const { applied, view } = await request("/api/game/admin", { method: "POST", body: JSON.stringify(body) });
  console.log(`✓ ${applied.length} event(s) appended: ${applied.map((e) => e.payload.type).join(", ") || "none (already applied)"}`);
  printStatus(view);
};

const main = async () => {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case "status":
      printStatus(await request("/api/game/save"));
      break;
    case "events": {
      const { events } = await request("/api/game/admin");
      for (const event of events.slice(0, Number(args[0] || 30))) {
        const { type, ...rest } = event.payload;
        console.log(`${String(event.seq).padStart(4)}  ${event.at.slice(0, 19)}  ${type.padEnd(22)} ${JSON.stringify(rest)}`);
      }
      break;
    }
    case "grant":
      if (!args[0]) { usage(); return; }
      await admin({ action: "grant", itemId: args[0], quantity: Number(args[1] || 1), reason: args[2] || "gift" });
      break;
    case "xp":
      if (!args[0]) { usage(); return; }
      await admin({ action: "xp", amount: Number(args[0]), reason: args[1] || "admin" });
      break;
    case "trait":
      if (!args[0] || args[1] === undefined) { usage(); return; }
      await admin({ action: "trait", trait: args[0], delta: Number(args[1]), reason: args[2] || "admin" });
      break;
    case "unlock":
      if (!args[0]) { usage(); return; }
      await admin({ action: "unlock-quest", slug: args[0] });
      break;
    case "reset-quest":
      if (!args[0]) { usage(); return; }
      await admin({ action: "reset-quest", slug: args[0] });
      break;
    case "rearm":
      await admin({ action: "rearm" });
      break;
    default:
      usage();
  }
};

try {
  await main();
} catch (error) {
  console.error("✗", error.message);
  process.exitCode = 1;
}
