import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHAGatewayActions, HAGatewayActionError } from "..";

const KEY = "cam-quest-key";

const setup = (
  respond: () => Promise<Response> = async () =>
    Response.json({ ok: true, action: "test_phone_notification" }),
  { url = "https://gateway.test", key = KEY } = {},
) => {
  const fetch = vi.fn((_url: string, _init: RequestInit) => respond());
  const actions = createHAGatewayActions({
    baseUrl: () => url || undefined,
    apiKey: () => key || undefined,
    fetch: fetch as never,
  });
  return { actions, fetch };
};

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("HA Gateway actions", () => {
  it("POSTs the action by name with the API key and params", async () => {
    const { actions, fetch } = setup();
    await actions.run("test_phone_notification", {
      title: "Cam Quest",
      message: "hi",
    });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://gateway.test/v1/actions/test_phone_notification");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).authorization).toBe(
      `Bearer ${KEY}`,
    );
    expect(JSON.parse(init.body as string)).toEqual({
      params: { title: "Cam Quest", message: "hi" },
    });
  });

  it("refuses to call when it isn't configured", async () => {
    const { actions, fetch } = setup(undefined, { key: "" });
    await expect(
      actions.run("test_phone_notification", {}),
    ).rejects.toMatchObject({ status: 503 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [401, "API key"],
    [502, "Home Assistant rejected"],
    [503, "isn't connected"],
  ])("explains a %i from the gateway", async (status, text) => {
    const { actions } = setup(async () => new Response(null, { status }));
    const error = await actions
      .run("test_phone_notification", {})
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HAGatewayActionError);
    expect(error).toMatchObject({ status });
    expect((error as Error).message).toContain(text);
  });

  it("reports an unreachable gateway without leaking the key", async () => {
    const { actions } = setup(async () => {
      throw new Error("ECONNREFUSED");
    });
    const error = await actions
      .run("test_phone_notification", {})
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 502 });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      KEY,
    );
  });
});
