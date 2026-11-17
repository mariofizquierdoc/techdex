import type { EventType, ItemStatus, Role } from "@prisma/client";

export const ITEM_STATUSES = ["IN_USE", "IN_STORAGE", "IN_REPAIR", "RETIRED"] as const satisfies readonly ItemStatus[];
export const ROLES = ["ADMIN", "VIEWER"] as const satisfies readonly Role[];

export const STATUS_LABEL: Record<ItemStatus, string> = {
  IN_USE: "In use",
  IN_STORAGE: "In storage",
  IN_REPAIR: "In repair",
  RETIRED: "Retired",
};

export const STATUS_CLASS: Record<ItemStatus, string> = {
  IN_USE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  IN_STORAGE: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  IN_REPAIR: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  RETIRED: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export const EVENT_LABEL: Record<EventType, string> = {
  PURCHASED: "Purchased",
  ASSIGNED: "Assigned",
  UNASSIGNED: "Returned",
  REPAIRED: "Repaired",
  STATUS_CHANGED: "Status changed",
  NOTE: "Note",
};
