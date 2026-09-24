// Validation for incoming gateway payloads. An explicit allow-list: an
// event name we don't know, a missing id or an id that doesn't look like
// one of ours is rejected, and only the listed fields are ever copied out.

import type { HAGatewayEvent, HAGatewayEventName } from "./types";

// Which `data` field carries the id for each accepted event.
const idFields = {
  TERMINAL_PRESSED: "terminalId",
  BEACON_ACTIVATED: "beaconId",
  AREA_ENTERED: "areaId",
} as const satisfies Record<HAGatewayEventName, string>;

// Cam Quest ids are short slugs ("signal-terminal"). Rejecting anything
// else keeps HA entity ids ("binary_sensor.foo") and junk out of the save.
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export type ValidationResult =
  | { ok: true; event: HAGatewayEvent }
  | { ok: false; code: "malformed" | "unsupported"; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isEventName = (value: string): value is HAGatewayEventName =>
  Object.hasOwn(idFields, value);

export const validateHAGatewayEvent = (body: unknown): ValidationResult => {
  if (!isRecord(body) || typeof body.event !== "string")
    return { ok: false, code: "malformed", message: "event is required" };
  if (!isEventName(body.event))
    return { ok: false, code: "unsupported", message: "Unsupported event" };
  if (!isRecord(body.data))
    return { ok: false, code: "malformed", message: "data is required" };

  const field = idFields[body.event];
  const id = body.data[field];
  if (typeof id !== "string" || !ID_PATTERN.test(id))
    return {
      ok: false,
      code: "malformed",
      message: `data.${field} must be a lowercase slug`,
    };

  // Rebuilt field by field so nothing else from the body travels on.
  switch (body.event) {
    case "TERMINAL_PRESSED":
      return {
        ok: true,
        event: { event: body.event, data: { terminalId: id } },
      };
    case "BEACON_ACTIVATED":
      return { ok: true, event: { event: body.event, data: { beaconId: id } } };
    case "AREA_ENTERED":
      return { ok: true, event: { event: body.event, data: { areaId: id } } };
  }
};
