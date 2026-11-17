import Link from "next/link";
import type { EventType, ItemStatus } from "@prisma/client";
import {
  ArrowRightLeftIcon,
  ShoppingCartIcon,
  StickyNoteIcon,
  UndoIcon,
  UserCheckIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import { EVENT_LABEL, STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

export type TimelineEvent = {
  id: string;
  type: EventType;
  occurredAt: Date;
  personId: string | null;
  personName: string | null;
  jobTitle: string | null;
  location: string | null;
  notes: string | null;
  fromStatus: ItemStatus | null;
  toStatus: ItemStatus | null;
  createdBy: string;
  /** Shown on the person page, where events from several items are mixed. */
  item?: { id: string; assetTag: string };
};

const ICON: Record<EventType, LucideIcon> = {
  PURCHASED: ShoppingCartIcon,
  ASSIGNED: UserCheckIcon,
  UNASSIGNED: UndoIcon,
  REPAIRED: WrenchIcon,
  STATUS_CHANGED: ArrowRightLeftIcon,
  NOTE: StickyNoteIcon,
};

const TONE: Record<EventType, string> = {
  PURCHASED: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  ASSIGNED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  UNASSIGNED: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  REPAIRED: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  STATUS_CHANGED: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  NOTE: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

function headline(e: TimelineEvent) {
  const person = !e.personName ? null : e.personId ? (
    <Link href={`/people/${e.personId}`} className="font-medium hover:underline">
      {e.personName}
    </Link>
  ) : (
    <span className="font-medium">{e.personName}</span>
  );
  switch (e.type) {
    case "ASSIGNED":
      return <>Assigned to {person}</>;
    case "UNASSIGNED":
      return (
        <>
          Returned by {person}
          {e.toStatus && e.toStatus !== "IN_USE" && <> → {STATUS_LABEL[e.toStatus].toLowerCase()}</>}
        </>
      );
    case "STATUS_CHANGED":
      return (
        <>
          {e.fromStatus ? STATUS_LABEL[e.fromStatus] : "?"} → {e.toStatus ? STATUS_LABEL[e.toStatus] : "?"}
        </>
      );
    default:
      return EVENT_LABEL[e.type];
  }
}

export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-muted-foreground">No history yet.</p>;

  return (
    <ol className="relative grid gap-5">
      <span className="absolute top-2 bottom-2 left-4 w-px bg-border" aria-hidden />
      {events.map((e) => {
        const Icon = ICON[e.type];
        const position = [e.jobTitle, e.location].filter(Boolean).join(" · ");
        return (
          <li key={e.id} className="relative flex gap-3">
            <span className={cn("z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card", TONE[e.type])}>
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1 pt-1 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p>
                  {e.item && (
                    <Link href={`/items/${e.item.id}`} className="mr-1.5 font-mono font-medium hover:underline">
                      {e.item.assetTag}
                    </Link>
                  )}
                  {headline(e)}
                </p>
                <time className="text-xs whitespace-nowrap text-muted-foreground">{formatDate(e.occurredAt)}</time>
              </div>
              {position && <p className="text-muted-foreground">{position}</p>}
              {e.notes && <p className="mt-1 whitespace-pre-wrap">{e.notes}</p>}
              <p className="mt-1 text-xs text-muted-foreground">Recorded by {e.createdBy}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
