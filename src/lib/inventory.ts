import type { ItemStatus, Prisma } from "@prisma/client";
import { db } from "./db";
import type {
  AssignInput,
  ItemInput,
  NoteInput,
  RepairInput,
  StatusInput,
  UnassignInput,
} from "./validation";

/** A business-rule violation whose message is safe to show to the user. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

type Tx = Prisma.TransactionClient;

async function getItemOrThrow(tx: Tx, itemId: string) {
  const item = await tx.item.findUnique({ where: { id: itemId } });
  if (!item) throw new DomainError("Item not found");
  return item;
}

function itemFields(input: ItemInput) {
  return {
    assetTag: input.assetTag,
    serialNumber: input.serialNumber ?? null,
    categoryId: input.categoryId,
    brand: input.brand ?? null,
    model: input.model ?? null,
    description: input.description,
    purchasePriceCents: input.purchasePrice ?? null,
    purchasedAt: input.purchasedAt ?? null,
  };
}

/** Creates an item in storage and records its PURCHASED event. */
export async function createItem(input: ItemInput, userId: string) {
  return db.$transaction(async (tx) => {
    const item = await tx.item.create({
      data: { ...itemFields(input), notes: input.notes ?? null, status: "IN_STORAGE" },
    });
    await tx.itemEvent.create({
      data: {
        itemId: item.id,
        type: "PURCHASED",
        occurredAt: input.purchasedAt ?? new Date(),
        notes: input.notes ?? null,
        toStatus: "IN_STORAGE",
        createdById: userId,
      },
    });
    return item;
  });
}

/** Edits descriptive fields. Status, assignment and condition change only through events. */
export async function updateItem(itemId: string, input: Omit<ItemInput, "notes">) {
  return db.$transaction(async (tx) => {
    await getItemOrThrow(tx, itemId);
    return tx.item.update({ where: { id: itemId }, data: itemFields(input as ItemInput) });
  });
}

export async function deleteItem(itemId: string) {
  await db.item.delete({ where: { id: itemId } });
}

/**
 * Assigns (or reassigns) an item. When it moves from someone else, an UNASSIGNED
 * event is written for the previous holder first. Assigning to the same person again
 * records their new job title / location.
 */
export async function assignItem(itemId: string, input: AssignInput, userId: string) {
  return db.$transaction(async (tx) => {
    const item = await getItemOrThrow(tx, itemId);
    if (item.status === "RETIRED") throw new DomainError("Retired items can't be assigned");

    const person = await tx.person.findUnique({ where: { id: input.personId } });
    if (!person) throw new DomainError("Person not found");
    if (!person.active) throw new DomainError(`${person.name} is inactive and can't receive items`);

    if (item.assigneeId && item.assigneeId !== person.id) {
      await tx.itemEvent.create({
        data: {
          itemId,
          type: "UNASSIGNED",
          occurredAt: input.occurredAt,
          personId: item.assigneeId,
          jobTitle: item.jobTitle,
          location: item.location,
          notes: `Reassigned to ${person.name}`,
          fromStatus: item.status,
          toStatus: "IN_USE",
          createdById: userId,
        },
      });
    }

    await tx.itemEvent.create({
      data: {
        itemId,
        type: "ASSIGNED",
        occurredAt: input.occurredAt,
        personId: person.id,
        jobTitle: input.jobTitle ?? null,
        location: input.location ?? null,
        notes: input.notes ?? null,
        fromStatus: item.status,
        toStatus: "IN_USE",
        createdById: userId,
      },
    });

    return tx.item.update({
      where: { id: itemId },
      data: {
        assigneeId: person.id,
        jobTitle: input.jobTitle ?? null,
        location: input.location ?? null,
        status: "IN_USE",
      },
    });
  });
}

async function unassignInTx(tx: Tx, itemId: string, input: UnassignInput, userId: string) {
  const item = await getItemOrThrow(tx, itemId);
  if (!item.assigneeId) throw new DomainError("Item isn't assigned to anyone");

  await tx.itemEvent.create({
    data: {
      itemId,
      type: "UNASSIGNED",
      occurredAt: input.occurredAt,
      personId: item.assigneeId,
      jobTitle: item.jobTitle,
      location: item.location,
      notes: input.notes ?? null,
      fromStatus: item.status,
      toStatus: input.toStatus,
      createdById: userId,
    },
  });

  return tx.item.update({
    where: { id: itemId },
    data: { assigneeId: null, jobTitle: null, location: null, status: input.toStatus },
  });
}

/** Takes an item back from its holder and moves it to storage, repair, or retirement. */
export async function unassignItem(itemId: string, input: UnassignInput, userId: string) {
  return db.$transaction((tx) => unassignInTx(tx, itemId, input, userId));
}

/**
 * Changes status. "In use" is only reachable by assigning. Moving an assigned item to
 * storage or retirement returns it from its holder; "in repair" keeps the holder.
 */
export async function changeStatus(itemId: string, input: StatusInput, userId: string) {
  return db.$transaction(async (tx) => {
    const item = await getItemOrThrow(tx, itemId);
    if (input.toStatus === item.status) throw new DomainError("Item already has that status");
    if (input.toStatus === "IN_USE") {
      if (!item.assigneeId) throw new DomainError("Assign the item to someone to mark it in use");
    } else if (item.assigneeId && input.toStatus !== "IN_REPAIR") {
      return unassignInTx(tx, itemId, { ...input, toStatus: input.toStatus }, userId);
    }

    await tx.itemEvent.create({
      data: {
        itemId,
        type: "STATUS_CHANGED",
        occurredAt: input.occurredAt,
        notes: input.notes ?? null,
        fromStatus: item.status,
        toStatus: input.toStatus,
        createdById: userId,
      },
    });
    return tx.item.update({ where: { id: itemId }, data: { status: input.toStatus } });
  });
}

/**
 * Records a repair. If the item was in repair it goes back into use (when assigned)
 * or into storage. An optional new condition replaces the item's notes.
 */
export async function recordRepair(itemId: string, input: RepairInput, userId: string) {
  return db.$transaction(async (tx) => {
    const item = await getItemOrThrow(tx, itemId);
    if (item.status === "RETIRED") throw new DomainError("Retired items can't be repaired");

    let toStatus: ItemStatus = item.status;
    if (item.status === "IN_REPAIR") toStatus = item.assigneeId ? "IN_USE" : "IN_STORAGE";

    await tx.itemEvent.create({
      data: {
        itemId,
        type: "REPAIRED",
        occurredAt: input.occurredAt,
        personId: item.assigneeId,
        notes: input.notes,
        fromStatus: item.status,
        toStatus,
        createdById: userId,
      },
    });
    return tx.item.update({
      where: { id: itemId },
      data: { status: toStatus, ...(input.condition ? { notes: input.condition } : {}) },
    });
  });
}

/** Adds a free-form note; optionally makes it the item's current condition notes. */
export async function addNote(itemId: string, input: NoteInput, userId: string) {
  return db.$transaction(async (tx) => {
    const item = await getItemOrThrow(tx, itemId);
    await tx.itemEvent.create({
      data: {
        itemId,
        type: "NOTE",
        occurredAt: input.occurredAt,
        personId: item.assigneeId,
        notes: input.notes,
        createdById: userId,
      },
    });
    if (input.setCondition) {
      return tx.item.update({ where: { id: itemId }, data: { notes: input.notes } });
    }
    return item;
  });
}

/** Deactivating someone who still holds items would hide those items' holder; block it. */
export async function setPersonActive(personId: string, active: boolean) {
  if (!active) {
    const held = await db.item.count({ where: { assigneeId: personId } });
    if (held > 0) {
      throw new DomainError(`This person still has ${held} item${held === 1 ? "" : "s"} assigned. Reassign or return them first.`);
    }
  }
  return db.person.update({ where: { id: personId }, data: { active } });
}

export async function deleteCategory(categoryId: string) {
  const used = await db.item.count({ where: { categoryId } });
  if (used > 0) throw new DomainError(`Category is used by ${used} item${used === 1 ? "" : "s"}`);
  await db.category.delete({ where: { id: categoryId } });
}
