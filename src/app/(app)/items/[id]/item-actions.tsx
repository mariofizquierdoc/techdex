"use client";

import * as React from "react";
import Link from "next/link";
import type { ItemStatus } from "@prisma/client";
import {
  ArrowRightLeftIcon,
  PencilIcon,
  StickyNoteIcon,
  Trash2Icon,
  UndoIcon,
  UserCheckIcon,
  WrenchIcon,
} from "lucide-react";
import { ActionDialog } from "@/components/action-dialog";
import { ConfirmAction } from "@/components/confirm-button";
import { Field } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toDateInput } from "@/lib/format";
import { ITEM_STATUSES, STATUS_LABEL } from "@/lib/labels";
import {
  addNoteAction,
  assignItemAction,
  changeStatusAction,
  deleteItemAction,
  recordRepairAction,
  unassignItemAction,
} from "../actions";

type PersonOption = { id: string; name: string; jobTitle: string; location: string };
type ItemSummary = { id: string; assetTag: string; status: ItemStatus; assigneeName: string | null };

const today = () => toDateInput(new Date());

function DateField({ error }: { error?: string[] }) {
  return (
    <Field label="Date *" htmlFor="occurredAt" error={error} hint="When it actually happened">
      <Input id="occurredAt" name="occurredAt" type="date" defaultValue={today()} required />
    </Field>
  );
}

function NotesField({ label = "Notes", error, required = false, placeholder }: { label?: string; error?: string[]; required?: boolean; placeholder?: string }) {
  return (
    <Field label={label} htmlFor="notes" error={error}>
      <Textarea id="notes" name="notes" rows={3} required={required} placeholder={placeholder} />
    </Field>
  );
}

function AssignFields({ people, error }: { people: PersonOption[]; error: Record<string, string[] | undefined> }) {
  const [jobTitle, setJobTitle] = React.useState("");
  const [location, setLocation] = React.useState("");

  return (
    <>
      <Field label="Person *" htmlFor="personId" error={error.personId}>
        <Select
          name="personId"
          onValueChange={(id) => {
            const p = people.find((x) => x.id === id);
            setJobTitle(p?.jobTitle ?? "");
            setLocation(p?.location ?? "");
          }}
        >
          <SelectTrigger id="personId" className="w-full">
            <SelectValue placeholder={people.length ? "Choose a person" : "No active people — add one first"} />
          </SelectTrigger>
          <SelectContent>
            {people.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Job title" htmlFor="jobTitle" error={error.jobTitle}>
          <Input id="jobTitle" name="jobTitle" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Designer" />
        </Field>
        <Field label="Location" htmlFor="location" error={error.location}>
          <Input id="location" name="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="HQ, floor 2" />
        </Field>
      </div>
      <DateField error={error.occurredAt} />
      <NotesField error={error.notes} />
    </>
  );
}

export function ItemActions({ item, people }: { item: ItemSummary; people: PersonOption[] }) {
  const assigned = !!item.assigneeName;
  const retired = item.status === "RETIRED";
  const statusOptions = ITEM_STATUSES.filter((s) => s !== item.status && (s !== "IN_USE" || assigned));

  return (
    <div className="flex flex-wrap gap-2">
      {!retired && (
        <ActionDialog
          title={assigned ? "Reassign item" : "Assign item"}
          description={
            assigned
              ? `Currently held by ${item.assigneeName}. Pick the same person to record a new job title or location.`
              : "Hand this item over to someone."
          }
          trigger={
            <Button>
              <UserCheckIcon /> {assigned ? "Reassign" : "Assign"}
            </Button>
          }
          action={assignItemAction.bind(null, item.id)}
          submitLabel="Assign"
        >
          {(s) => <AssignFields people={people} error={s.fieldErrors ?? {}} />}
        </ActionDialog>
      )}

      {assigned && (
        <ActionDialog
          title="Return item"
          description={`Take ${item.assetTag} back from ${item.assigneeName}.`}
          trigger={
            <Button variant="outline">
              <UndoIcon /> Return
            </Button>
          }
          action={unassignItemAction.bind(null, item.id)}
          submitLabel="Return item"
        >
          {(s) => (
            <>
              <Field label="Move to *" htmlFor="toStatus" error={s.fieldErrors?.toStatus}>
                <Select name="toStatus" defaultValue="IN_STORAGE">
                  <SelectTrigger id="toStatus" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["IN_STORAGE", "IN_REPAIR", "RETIRED"] as const).map((st) => (
                      <SelectItem key={st} value={st}>
                        {STATUS_LABEL[st]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <DateField error={s.fieldErrors?.occurredAt} />
              <NotesField error={s.fieldErrors?.notes} placeholder="Reason, condition on return…" />
            </>
          )}
        </ActionDialog>
      )}

      {!retired && (
        <ActionDialog
          title="Record repair"
          description={item.status === "IN_REPAIR" ? "The item will go back into use (or storage if unassigned)." : undefined}
          trigger={
            <Button variant="outline">
              <WrenchIcon /> Repair
            </Button>
          }
          action={recordRepairAction.bind(null, item.id)}
          submitLabel="Record repair"
        >
          {(s) => (
            <>
              <DateField error={s.fieldErrors?.occurredAt} />
              <NotesField label="What was repaired *" required error={s.fieldErrors?.notes} placeholder="Replaced screen at vendor" />
              <Field label="New condition" htmlFor="condition" error={s.fieldErrors?.condition} hint="Leave empty to keep the current condition notes">
                <Input id="condition" name="condition" placeholder="Good, 8/10" />
              </Field>
            </>
          )}
        </ActionDialog>
      )}

      <ActionDialog
        title="Add note"
        trigger={
          <Button variant="outline">
            <StickyNoteIcon /> Note
          </Button>
        }
        action={addNoteAction.bind(null, item.id)}
        submitLabel="Add note"
      >
        {(s) => (
          <>
            <DateField error={s.fieldErrors?.occurredAt} />
            <NotesField label="Note *" required error={s.fieldErrors?.notes} placeholder='e.g. "screen not working", "good 7/10"' />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="setCondition" defaultChecked className="size-4 accent-primary" />
              Also set as the item&apos;s current condition
            </label>
          </>
        )}
      </ActionDialog>

      <ActionDialog
        title="Change status"
        description={
          item.assigneeName
            ? `Moving to storage or retired also returns it from ${item.assigneeName}. "In repair" keeps the assignee.`
            : '"In use" requires assigning the item to someone.'
        }
        trigger={
          <Button variant="outline">
            <ArrowRightLeftIcon /> Status
          </Button>
        }
        action={changeStatusAction.bind(null, item.id)}
        submitLabel="Update status"
      >
        {(s) => (
          <>
            <Field label="New status *" htmlFor="toStatus" error={s.fieldErrors?.toStatus}>
              <Select name="toStatus" defaultValue={statusOptions[0]}>
                <SelectTrigger id="toStatus" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((st) => (
                    <SelectItem key={st} value={st}>
                      {STATUS_LABEL[st]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <DateField error={s.fieldErrors?.occurredAt} />
            <NotesField error={s.fieldErrors?.notes} placeholder="Reason" />
          </>
        )}
      </ActionDialog>

      <Button variant="outline" asChild>
        <Link href={`/items/${item.id}/edit`}>
          <PencilIcon /> Edit
        </Link>
      </Button>

      <ConfirmAction
        title={`Delete ${item.assetTag}?`}
        description="This permanently removes the item and its entire history. To keep the history, change its status to Retired instead."
        confirmLabel="Delete"
        action={() => deleteItemAction(item.id)}
        trigger={
          <Button variant="destructive" size="icon" aria-label="Delete item" title="Delete item">
            <Trash2Icon />
          </Button>
        }
      />
    </div>
  );
}
