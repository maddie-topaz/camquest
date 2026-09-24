// POST /api/ha-gateway/events: authenticate, validate, translate, then
// hand the world event to the game. Works on plain Web Request/Response
// so it can be tested without Next.

import type { WorldEventResult } from "@/lib/game/dispatch";
import type { WorldEvent } from "@/lib/game/types";
import { toWorldEvent } from "./adapter";
import { isAuthorized } from "./auth";
import { validateHAGatewayEvent } from "./events";

// Gateway events are a few dozen bytes; anything much bigger isn't one.
const MAX_BODY_BYTES = 4 * 1024;

type Deps = {
  // Read per request so a rotated secret takes effect without a restart.
  secret: () => string | undefined;
  dispatch: (event: WorldEvent) => Promise<WorldEventResult>;
};

const reply = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status });

export const createHAGatewayWebhook =
  ({ secret, dispatch }: Deps) =>
  async (request: Request): Promise<Response> => {
    const expected = secret();
    if (!expected) {
      console.error("[HA Gateway] HA_GATEWAY_WEBHOOK_SECRET is not set");
      return reply(500, { error: "Webhook is not configured" });
    }
    if (!isAuthorized(request.headers.get("authorization"), expected))
      return reply(401, { error: "Unauthorized" });

    const text = await request.text().catch(() => null);
    if (text === null) return reply(400, { error: "Unreadable body" });
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES)
      return reply(413, { error: "Payload too large" });
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return reply(400, { error: "Body must be JSON" });
    }

    const validation = validateHAGatewayEvent(body);
    if (!validation.ok) {
      console.warn(`[HA Gateway] rejected payload: ${validation.message}`);
      return reply(400, { error: validation.message });
    }
    console.info(`[HA Gateway] received ${validation.event.event}`);

    const worldEvent = toWorldEvent(validation.event);
    console.info(`[HA Gateway] translated → ${worldEvent.type}`);

    try {
      const result = await dispatch(worldEvent);
      return reply(200, { ok: true, changed: result.changed });
    } catch (error) {
      console.error(
        "[HA Gateway] failed to handle event",
        error instanceof Error ? error.message : error,
      );
      return reply(500, { error: "Failed to handle event" });
    }
  };
