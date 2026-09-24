import { NextResponse } from "next/server";
import {
  createHAGatewayActions,
  HAGatewayActionError,
} from "@/lib/integrations/ha-gateway";

export const runtime = "nodejs";

const MAX_MESSAGE_LENGTH = 200;

const actions = createHAGatewayActions({
  baseUrl: () => process.env.HA_GATEWAY_URL,
  apiKey: () => process.env.HA_GATEWAY_API_KEY,
});

// Dev tools: sends a test push to Maddie's phone through ha-gateway's
// `test_phone_notification` action. Only the message is up to the caller;
// the action and the phone are fixed.
export const POST = async (request: Request) => {
  const body = await request.json().catch(() => null);
  const message =
    typeof body?.message === "string" ? body.message.trim() : undefined;
  if (message !== undefined && message.length > MAX_MESSAGE_LENGTH)
    return NextResponse.json(
      { error: `message must be at most ${MAX_MESSAGE_LENGTH} characters` },
      { status: 400 },
    );

  try {
    await actions.run("test_phone_notification", {
      title: "Test notification",
      ...(message ? { message } : {}),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof HAGatewayActionError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status >= 500 ? error.status : 502 },
      );
    console.error("Failed to send HA notification", error);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 },
    );
  }
};
