import { createWorldEventDispatcher } from "@/lib/game/dispatch";
import { DEFAULT_PLAYER, runWorldEvent } from "@/lib/game/store";
import { createHAGatewayWebhook } from "@/lib/integrations/ha-gateway";

export const runtime = "nodejs";

// Where ha-gateway reports physical-world events. Only POST is exported,
// so Next answers any other method with a 405.
export const POST = createHAGatewayWebhook({
  secret: () => process.env.HA_GATEWAY_WEBHOOK_SECRET,
  dispatch: createWorldEventDispatcher({
    run: runWorldEvent,
    playerId: DEFAULT_PLAYER,
  }),
});
