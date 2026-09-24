// Cam Quest → ha-gateway: asking the gateway to run one of the actions it
// grants this app (POST /v1/actions/:name). The gateway owns the Home
// Assistant side (entity ids, services, which phone); we only know action
// names and their params. Server-only: the API key never reaches React.

// Actions Cam Quest calls, as named in ha-gateway's src/apps/cam-quest.
// Add a name here when something starts using it.
export type HAGatewayAction = {
  // Maddie's Pixel, via notify.maddie_s_mobile.
  test_phone_notification: { title?: string; message?: string };
  // Maddie's Pixel reads `message` aloud (companion app TTS, media volume).
  say_on_maddies_phone: { message: string };
};

export type HAGatewayActionName = keyof HAGatewayAction;

// The gateway answers within 10s or gives up with a 504; allow a little
// more so we see its answer rather than our own timeout.
const TIMEOUT_MS = 12_000;

export class HAGatewayActionError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "HAGatewayActionError";
    this.status = status;
  }
}

type Deps = {
  // Read per call so env changes apply without a restart.
  baseUrl: () => string | undefined;
  apiKey: () => string | undefined;
  fetch?: typeof fetch;
};

// What each gateway status means for us, in words safe to show on /dev.
const describeFailure = (status: number) => {
  switch (status) {
    case 400:
      return "The gateway rejected the params";
    case 401:
      return "The gateway rejected Cam Quest's API key";
    case 404:
      return "The gateway doesn't give Cam Quest that action";
    case 502:
      return "Home Assistant rejected the call";
    case 503:
      return "The gateway isn't connected to Home Assistant";
    case 504:
      return "Home Assistant didn't answer in time";
    default:
      return `The gateway answered ${status}`;
  }
};

export const createHAGatewayActions = ({
  baseUrl,
  apiKey,
  fetch: send = fetch,
}: Deps) => ({
  run: async <Name extends HAGatewayActionName>(
    name: Name,
    params: HAGatewayAction[Name],
  ) => {
    const url = baseUrl();
    const key = apiKey();
    if (!url || !key)
      throw new HAGatewayActionError(
        "HA_GATEWAY_URL and HA_GATEWAY_API_KEY must be set",
        503,
      );

    let response: Response;
    try {
      response = await send(new URL(`/v1/actions/${name}`, url).toString(), {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ params }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      console.error(
        `[HA Gateway] action ${name} unreachable:`,
        error instanceof Error ? error.message : error,
      );
      throw new HAGatewayActionError("Couldn't reach the gateway", 502);
    }

    if (!response.ok) {
      console.warn(`[HA Gateway] action ${name} failed: ${response.status}`);
      throw new HAGatewayActionError(
        describeFailure(response.status),
        response.status,
      );
    }
    console.info(`[HA Gateway] ran action ${name}`);
  },
});

export type HAGatewayActions = ReturnType<typeof createHAGatewayActions>;
