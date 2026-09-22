// Every item that can exist in a pack. Add a row here, then grant it via
// a quest reward or `scripts/game.mjs grant <id>`.

// What an item fundamentally is. Drives which Inventory screen section it
// sorts into.
export type ItemKind = "keepsake" | "quest-item" | "trinket";

// What an item can do, or how the game treats it. An item can carry any
// number of these — e.g. a trinket can be both "usable" and "consumable".
export type ItemTrait =
  | "usable"
  | "consumable"
  | "access"
  | "companion-related";

export type ItemDefinition = {
  id: string;
  name: string;
  description: string;
  // Shown in the profile while the player doesn't hold the item.
  unlockHint: string;
  // Name of a lucide icon registered in inventoryIcons (app/page.tsx).
  icon: string;
  color: string;
  tilt: string;
  sortOrder: number;
  kind: ItemKind;
  traits?: ItemTrait[];
};

export const items: ItemDefinition[] = [
  {
    id: "vip-wristband",
    name: "VIP wristband",
    description: "Proof you survived Ruggy’s 35th.",
    unlockHint: "Starter item",
    icon: "Ticket",
    color: "#ffd166",
    tilt: "-12deg",
    sortOrder: 10,
    kind: "quest-item",
    traits: ["access"],
  },
  {
    id: "cowbell",
    name: "Cowbell",
    description: "Your years of training have led to this.",
    unlockHint: "Starter item",
    icon: "Bell",
    color: "#55e7ff",
    tilt: "8deg",
    sortOrder: 20,
    kind: "trinket",
    traits: ["usable"],
  },
  {
    id: "kitanas-blessing",
    name: "Kitana's Blessing",
    description: "Said to bring luck. Kitana makes no guarantees.",
    unlockHint: "Starter item",
    icon: "PawPrint",
    color: "#ff75c8",
    tilt: "-5deg",
    sortOrder: 30,
    kind: "keepsake",
    traits: ["companion-related"],
  },
  {
    id: "biltong-fragment",
    name: "Biltong fragment",
    description: "A household staple with contested ownership.",
    unlockHint: "Starter item",
    icon: "Beef",
    color: "#d9a066",
    tilt: "6deg",
    sortOrder: 35,
    kind: "trinket",
    traits: ["usable", "consumable", "companion-related"],
  },
  {
    id: "golden-key",
    name: "Golden key",
    description: "Won from the signal. It opens something.",
    unlockHint: "Lock the signal with a clean score.",
    icon: "KeyRound",
    color: "#ffd166",
    tilt: "-8deg",
    sortOrder: 40,
    kind: "quest-item",
    traits: ["usable", "access"],
  },
];

export const itemsById: Record<string, ItemDefinition> = Object.fromEntries(
  items.map((item) => [item.id, item]),
);

export const getItem = (id: string) => itemsById[id];

// What a brand-new save starts with. Each entry becomes one pending grant
// keyed `starter:<itemId>`, so re-running setup never doubles up.
export const starterLoadout: { itemId: string; quantity: number }[] = [
  { itemId: "vip-wristband", quantity: 1 },
  { itemId: "cowbell", quantity: 1 },
  { itemId: "kitanas-blessing", quantity: 1 },
  { itemId: "biltong-fragment", quantity: 1 },
];
