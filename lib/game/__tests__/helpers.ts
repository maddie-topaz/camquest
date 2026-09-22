import { applyEvent, emptySave } from "../reducer";
import type {
  GameEvent,
  GameEventPayload,
  NewGameEvent,
  SaveFile,
} from "../types";

// Builds a save by applying payloads in order, minting keys and seqs the
// way the store would. Keys can be pinned by passing { key, payload }.
export const saveFrom = (
  events: (GameEventPayload | NewGameEvent)[],
  playerId = "test",
) =>
  events.reduce<SaveFile>((save, entry, index) => {
    const seq = index + 1;
    const at = new Date(Date.UTC(2026, 0, 1, 0, 0, seq)).toISOString();
    const event: GameEvent =
      "payload" in entry
        ? { seq, key: entry.key ?? `evt:${seq}`, at, payload: entry.payload }
        : { seq, key: `evt:${seq}`, at, payload: entry };
    return applyEvent(save, event);
  }, emptySave(playerId));

export const created = (name = "Cam"): GameEventPayload => ({
  type: "player.created",
  name,
});
export const granted = (
  itemId: string,
  quantity = 1,
  reason = "test",
  key?: string,
): NewGameEvent => ({
  key: key ?? `grant:${itemId}:${quantity}`,
  payload: { type: "item.granted", itemId, quantity, reason },
});
export const completed = (slug: string): GameEventPayload => ({
  type: "quest.completed",
  slug,
  answers: {},
});
