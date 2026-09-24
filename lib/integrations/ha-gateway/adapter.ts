// Gateway payload → Cam Quest world event. The seam where the gateway's
// wire format stops: nothing past this knows the gateway exists.

import type { WorldEvent } from "@/lib/game/types";
import type { HAGatewayEvent } from "./types";

export const toWorldEvent = (payload: HAGatewayEvent): WorldEvent => {
  switch (payload.event) {
    case "TERMINAL_PRESSED":
      return { type: "TERMINAL_PRESSED", terminalId: payload.data.terminalId };
    case "BEACON_ACTIVATED":
      return { type: "BEACON_ACTIVATED", beaconId: payload.data.beaconId };
    case "AREA_ENTERED":
      return { type: "AREA_ENTERED", areaId: payload.data.areaId };
  }
};
