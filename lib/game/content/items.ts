// Every item that can exist in a pack. Add a row here, then grant it via
// a quest reward or `scripts/game.mjs grant <id>`.

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
  // Can quests spend it? Keepsakes are permanent.
  consumable?: boolean;
  // Drives which Inventory screen section the item sorts into. Defaults to
  // "keepsake" when omitted.
  category?: "consumable" | "quest-item" | "keepsake";
  tags?: string[];
};

export const items: ItemDefinition[] = [
  {
    id: "vip-wristband",
    name: "VIP wristband",
    description: "Access all areas. Nobody has said which areas.",
    unlockHint: "Starter item",
    icon: "Ticket",
    color: "#ffd166",
    tilt: "-12deg",
    sortOrder: 10,
    tags: ["access"],
  },
  {
    id: "cowbell",
    name: "Cowbell",
    description: "The prescription was more of this.",
    unlockHint: "Starter item",
    icon: "Bell",
    color: "#55e7ff",
    tilt: "8deg",
    sortOrder: 20,
    consumable: true,
    category: "consumable",
  },
  {
    id: "kitanas-blessing",
    name: "Kitana's Blessing",
    description: "A lucky cat relic. The paw still waves.",
    unlockHint: "Starter item",
    icon: "Cat",
    color: "#ff75c8",
    tilt: "-5deg",
    sortOrder: 30,
    tags: ["relic"],
  },
  {
    id: "biltong-fragment",
    name: "Biltong fragment",
    description: "Cured, dried, and somehow still going.",
    unlockHint: "Starter item",
    icon: "Beef",
    color: "#d9a066",
    tilt: "6deg",
    sortOrder: 35,
    consumable: true,
    category: "consumable",
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
    category: "quest-item",
    tags: ["access"],
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
