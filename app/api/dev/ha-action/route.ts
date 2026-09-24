import { NextResponse } from "next/server";
import {
  createHAGatewayActions,
  HAGatewayActionError,
  type HAGatewayActionName,
} from "@/lib/integrations/ha-gateway";

export const runtime = "nodejs";

const MAX_MESSAGE_LENGTH = 200;

const actions = createHAGatewayActions({
  baseUrl: () => process.env.HA_GATEWAY_URL,
  apiKey: () => process.env.HA_GATEWAY_API_KEY,
});

// The gateway actions the dev tools may run, and how the one free-text
// field becomes that action's params. Anything else is a 400.
const devActions = {
  test_phone_notification: (message: string) =>
    actions.run("test_phone_notification", {
      title: "Test notification",
      ...(message ? { message } : {}),
    }),
  say_on_maddies_phone: (message: string) =>
    actions.run("say_on_maddies_phone", { message }),
} satisfies Partial<
  Record<HAGatewayActionName, (message: string) => Promise<void>>
>;

type DevAction = keyof typeof devActions;

const isDevAction = (value: unknown): value is DevAction =>
  typeof value === "string" && Object.hasOwn(devActions, value);

// Dev tools: runs one allow-listed ha-gateway action with a message.
// Which phone or speaker it reaches is fixed by the gateway.
export const POST = async (request: Request) => {
  const body = await request.json().catch(() => null);
  const action: unknown = body?.action;
  if (!isDevAction(action))
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length > MAX_MESSAGE_LENGTH)
    return NextResponse.json(
      { error: `message must be at most ${MAX_MESSAGE_LENGTH} characters` },
      { status: 400 },
    );
  if (action === "say_on_maddies_phone" && !message)
    return NextResponse.json({ error: "message is required" }, { status: 400 });

  try {
    await devActions[action](message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof HAGatewayActionError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status >= 500 ? error.status : 502 },
      );
    console.error("Failed to run HA action", action, error);
    return NextResponse.json(
      { error: "Failed to run action" },
      { status: 500 },
    );
  }
};
