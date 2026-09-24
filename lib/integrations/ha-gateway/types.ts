// The contract between the ha-gateway service and Cam Quest: the only
// payloads the webhook accepts. The gateway owns Home Assistant (entity
// ids, services, its WebSocket); by the time an event reaches us it is
// already named in Cam Quest terms.

export type HAGatewayEvent =
  | { event: "TERMINAL_PRESSED"; data: { terminalId: string } }
  | { event: "BEACON_ACTIVATED"; data: { beaconId: string } }
  | { event: "AREA_ENTERED"; data: { areaId: string } };

export type HAGatewayEventName = HAGatewayEvent["event"];
