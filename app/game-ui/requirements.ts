import { getQuest } from "@/lib/game/content/quests";
import { traits as traitDefinitions } from "@/lib/game/content/traits";
import { tendencies as tendencyDefinitions } from "@/lib/game/content/tendencies";
import type { Requirements } from "@/lib/game/types";

// Turns a missing-requirements object into copy for a locked quest card.
export function describeRequirements(missing: Requirements) {
  const parts: string[] = [];
  if (missing.unlock) parts.push("a signal you haven't found yet");
  for (const slug of missing.questsCompleted ?? [])
    parts.push(`completing ${getQuest(slug)?.title ?? slug}`);
  for (const itemId of missing.items ?? [])
    parts.push(`holding the ${itemId.replace(/-/g, " ")}`);
  for (const [trait, min] of Object.entries(missing.traits ?? {}))
    parts.push(
      `${traitDefinitions.find((t) => t.id === trait)?.name ?? trait} ${min}+`,
    );
  for (const [tendency, min] of Object.entries(missing.tendencies ?? {}))
    parts.push(
      `${tendencyDefinitions.find((t) => t.id === tendency)?.name ?? tendency} ${min}+`,
    );
  if (missing.level) parts.push(`level ${missing.level}`);
  for (const id of missing.achievements ?? [])
    parts.push(`the ${id.replace(/-/g, " ")} achievement`);
  return parts.length ? `Requires ${parts.join(", ")}.` : "Locked.";
}
