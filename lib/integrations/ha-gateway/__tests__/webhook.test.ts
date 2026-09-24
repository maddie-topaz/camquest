import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorldEvent } from "@/lib/game/types";
import {
  createHAGatewayWebhook,
  toWorldEvent,
  validateHAGatewayEvent,
} from "..";

const SECRET = "test-secret";

const setup = (dispatchImpl?: (event: WorldEvent) => Promise<unknown>) => {
  const dispatch = vi.fn(
    dispatchImpl ?? (async () => ({ changed: true, quests: [] })),
  );
  const handler = createHAGatewayWebhook({
    secret: () => SECRET,
    dispatch: dispatch as never,
  });
  return { handler, dispatch };
};

const post = (
  body: unknown,
  authorization: string | null = `Bearer ${SECRET}`,
) =>
  new Request("http://localhost/api/ha-gateway/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const terminalPressed = {
  event: "TERMINAL_PRESSED",
  data: { terminalId: "signal-terminal" },
};

afterEach(() => vi.restoreAllMocks());

describe("HA Gateway webhook", () => {
  it("dispatches a valid, authenticated event as a Cam Quest world event", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { handler, dispatch } = setup();
    const response = await handler(post(terminalPressed));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, changed: true });
    expect(dispatch).toHaveBeenCalledWith({
      type: "TERMINAL_PRESSED",
      terminalId: "signal-terminal",
    });
  });

  it.each([
    ["missing", null],
    ["wrong secret", "Bearer nope"],
    ["wrong scheme", `Basic ${SECRET}`],
  ])("rejects %s auth with 401 and never dispatches", async (_, header) => {
    const { handler, dispatch } = setup();
    const response = await handler(post(terminalPressed, header));
    expect(response.status).toBe(401);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("refuses everything with 500 when no secret is configured", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = createHAGatewayWebhook({
      secret: () => undefined,
      dispatch: vi.fn() as never,
    });
    expect((await handler(post(terminalPressed, "Bearer "))).status).toBe(500);
  });

  it("rejects malformed JSON with 400", async () => {
    const { handler, dispatch } = setup();
    expect((await handler(post("{not json"))).status).toBe(400);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("rejects an unsupported event with 400", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { handler, dispatch } = setup();
    const response = await handler(
      post({ event: "light.turn_on", data: { entity_id: "light.kitchen" } }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Unsupported event" });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("rejects a payload that is too large with 413", async () => {
    const { handler } = setup();
    const response = await handler(
      post({ ...terminalPressed, padding: "x".repeat(5000) }),
    );
    expect(response.status).toBe(413);
  });

  it("returns 500 without details when the game fails", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { handler } = setup(async () => {
      throw new Error("db exploded: password=hunter2");
    });
    const response = await handler(post(terminalPressed));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("hunter2");
  });
});

describe("validateHAGatewayEvent", () => {
  it("copies only the known field, dropping anything else", () => {
    const result = validateHAGatewayEvent({
      event: "TERMINAL_PRESSED",
      data: { terminalId: "signal-terminal", entity_id: "switch.x" },
      service: "homeassistant.turn_on",
    });
    expect(result).toEqual({
      ok: true,
      event: {
        event: "TERMINAL_PRESSED",
        data: { terminalId: "signal-terminal" },
      },
    });
  });

  it.each([
    [{}],
    [{ event: "TERMINAL_PRESSED" }],
    [{ event: "TERMINAL_PRESSED", data: {} }],
    [{ event: "TERMINAL_PRESSED", data: { terminalId: 7 } }],
    // A Home Assistant entity id is not a Cam Quest id.
    [
      {
        event: "TERMINAL_PRESSED",
        data: { terminalId: "binary_sensor.button" },
      },
    ],
    [{ event: "BEACON_ACTIVATED", data: { terminalId: "signal-terminal" } }],
    [[]],
  ])("rejects %j as malformed", (body) => {
    expect(validateHAGatewayEvent(body)).toMatchObject({
      ok: false,
      code: "malformed",
    });
  });

  it("rejects inherited property names as unsupported", () => {
    expect(
      validateHAGatewayEvent({ event: "toString", data: {} }),
    ).toMatchObject({ ok: false, code: "unsupported" });
  });
});

describe("toWorldEvent", () => {
  it("translates each gateway event into a world event", () => {
    expect(
      toWorldEvent({ event: "TERMINAL_PRESSED", data: { terminalId: "t" } }),
    ).toEqual({ type: "TERMINAL_PRESSED", terminalId: "t" });
    expect(
      toWorldEvent({ event: "BEACON_ACTIVATED", data: { beaconId: "b" } }),
    ).toEqual({ type: "BEACON_ACTIVATED", beaconId: "b" });
    expect(
      toWorldEvent({ event: "AREA_ENTERED", data: { areaId: "a" } }),
    ).toEqual({ type: "AREA_ENTERED", areaId: "a" });
  });
});
