import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import {
  DomainError,
  addNote,
  assignItem,
  changeStatus,
  createItem,
  recordRepair,
  setPersonActive,
  unassignItem,
} from "./inventory";
import { itemSchema } from "./validation";

let userId: string;
let categoryId: string;

const d = (iso: string) => new Date(`${iso}T12:00:00`);

async function newItem(tag = "LT-1") {
  return createItem(
    itemSchema.parse({ assetTag: tag, categoryId, description: "Laptop", notes: "New", purchasedAt: "2026-01-10", purchasePrice: "999.99" }),
    userId,
  );
}

async function events(itemId: string) {
  return db.itemEvent.findMany({ where: { itemId }, orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }] });
}

beforeEach(async () => {
  await db.itemEvent.deleteMany();
  await db.item.deleteMany();
  await db.person.deleteMany();
  await db.category.deleteMany();
  await db.user.deleteMany();
  userId = (await db.user.create({ data: { email: "a@x.com", name: "A", passwordHash: "x", role: "ADMIN" } })).id;
  categoryId = (await db.category.create({ data: { name: "Laptop" } })).id;
});

describe("createItem", () => {
  it("stores the item in storage and writes a PURCHASED event dated at purchase", async () => {
    const item = await newItem();
    expect(item.status).toBe("IN_STORAGE");
    expect(item.purchasePriceCents).toBe(99999);
    const ev = await events(item.id);
    expect(ev).toHaveLength(1);
    expect(ev[0].type).toBe("PURCHASED");
    expect(ev[0].occurredAt.toISOString()).toBe(d("2026-01-10").toISOString());
  });
});

describe("assignItem", () => {
  it("assigns, then reassigns writing UNASSIGNED for the previous holder with their position snapshot", async () => {
    const item = await newItem();
    const ana = await db.person.create({ data: { name: "Ana", email: "ana@x.com" } });
    const ben = await db.person.create({ data: { name: "Ben", email: "ben@x.com" } });

    await assignItem(item.id, { personId: ana.id, jobTitle: "Designer", location: "HQ", occurredAt: d("2026-02-01") }, userId);
    const after = await assignItem(item.id, { personId: ben.id, jobTitle: "Dev", location: "Remote", occurredAt: d("2026-03-01") }, userId);

    expect(after).toMatchObject({ assigneeId: ben.id, jobTitle: "Dev", location: "Remote", status: "IN_USE" });
    const ev = await events(item.id);
    expect(ev.map((e) => e.type)).toEqual(["PURCHASED", "ASSIGNED", "UNASSIGNED", "ASSIGNED"]);
    expect(ev[2]).toMatchObject({ personId: ana.id, jobTitle: "Designer", location: "HQ", toStatus: "IN_USE", notes: null });
    expect(ev[3]).toMatchObject({ personId: ben.id, jobTitle: "Dev", location: "Remote" });
  });

  it("re-assigning to the same person only records the new position", async () => {
    const item = await newItem();
    const ana = await db.person.create({ data: { name: "Ana", email: "ana@x.com" } });
    await assignItem(item.id, { personId: ana.id, jobTitle: "Junior", occurredAt: d("2026-02-01") }, userId);
    await assignItem(item.id, { personId: ana.id, jobTitle: "Senior", occurredAt: d("2026-06-01") }, userId);
    expect((await events(item.id)).map((e) => e.type)).toEqual(["PURCHASED", "ASSIGNED", "ASSIGNED"]);
  });

  it("rejects inactive people and retired items", async () => {
    const item = await newItem();
    const gone = await db.person.create({ data: { name: "Gone", email: "g@x.com", active: false } });
    await expect(assignItem(item.id, { personId: gone.id, occurredAt: d("2026-02-01") }, userId)).rejects.toMatchObject({
      code: "personInactive",
      params: { name: "Gone" },
    });

    const ana = await db.person.create({ data: { name: "Ana", email: "ana@x.com" } });
    await changeStatus(item.id, { toStatus: "RETIRED", occurredAt: d("2026-02-01") }, userId);
    await expect(assignItem(item.id, { personId: ana.id, occurredAt: d("2026-02-02") }, userId)).rejects.toMatchObject({
      code: "retiredCannotAssign",
    });
  });

  it("rolls back the UNASSIGNED event when assignment fails", async () => {
    const item = await newItem();
    const ana = await db.person.create({ data: { name: "Ana", email: "ana@x.com" } });
    await assignItem(item.id, { personId: ana.id, occurredAt: d("2026-02-01") }, userId);
    await expect(assignItem(item.id, { personId: "missing", occurredAt: d("2026-03-01") }, userId)).rejects.toThrow();
    expect(await events(item.id)).toHaveLength(2);
  });
});

describe("unassign / status / repair / note", () => {
  it("returning an item clears the assignment and sets the chosen status", async () => {
    const item = await newItem();
    const ana = await db.person.create({ data: { name: "Ana", email: "ana@x.com" } });
    await assignItem(item.id, { personId: ana.id, location: "HQ", occurredAt: d("2026-02-01") }, userId);
    const after = await unassignItem(item.id, { toStatus: "IN_STORAGE", occurredAt: d("2026-03-01") }, userId);
    expect(after).toMatchObject({ assigneeId: null, location: null, status: "IN_STORAGE" });
    await expect(unassignItem(item.id, { toStatus: "IN_STORAGE", occurredAt: d("2026-03-02") }, userId)).rejects.toMatchObject({
      code: "notAssigned",
    });
  });

  it("can't set 'in use' without an assignee; retiring an assigned item returns it", async () => {
    const item = await newItem();
    await expect(changeStatus(item.id, { toStatus: "IN_USE", occurredAt: d("2026-02-01") }, userId)).rejects.toThrow(DomainError);
    await expect(changeStatus(item.id, { toStatus: "IN_USE", occurredAt: d("2026-02-01") }, userId)).rejects.toMatchObject({ code: "assignToUse" });

    const ana = await db.person.create({ data: { name: "Ana", email: "ana@x.com" } });
    await assignItem(item.id, { personId: ana.id, occurredAt: d("2026-02-01") }, userId);
    const retired = await changeStatus(item.id, { toStatus: "RETIRED", occurredAt: d("2026-03-01") }, userId);
    expect(retired).toMatchObject({ status: "RETIRED", assigneeId: null });
    expect((await events(item.id)).at(-1)?.type).toBe("UNASSIGNED");
  });

  it("repair of an in-repair assigned item puts it back in use and updates condition", async () => {
    const item = await newItem();
    const ana = await db.person.create({ data: { name: "Ana", email: "ana@x.com" } });
    await assignItem(item.id, { personId: ana.id, occurredAt: d("2026-02-01") }, userId);
    await changeStatus(item.id, { toStatus: "IN_REPAIR", occurredAt: d("2026-03-01") }, userId);
    const after = await recordRepair(item.id, { notes: "New screen", condition: "Good 8/10", occurredAt: d("2026-03-10") }, userId);
    expect(after).toMatchObject({ status: "IN_USE", assigneeId: ana.id, notes: "Good 8/10" });
  });

  it("notes only replace the condition when asked", async () => {
    const item = await newItem();
    await addNote(item.id, { notes: "Small scratch", setCondition: false, occurredAt: d("2026-02-01") }, userId);
    expect((await db.item.findUniqueOrThrow({ where: { id: item.id } })).notes).toBe("New");
    await addNote(item.id, { notes: "Screen not working", setCondition: true, occurredAt: d("2026-02-02") }, userId);
    expect((await db.item.findUniqueOrThrow({ where: { id: item.id } })).notes).toBe("Screen not working");
  });
});

describe("setPersonActive", () => {
  it("blocks deactivating someone who still holds items", async () => {
    const item = await newItem();
    const ana = await db.person.create({ data: { name: "Ana", email: "ana@x.com" } });
    await assignItem(item.id, { personId: ana.id, occurredAt: d("2026-02-01") }, userId);
    await expect(setPersonActive(ana.id, false)).rejects.toMatchObject({ code: "personHoldsItems", params: { count: 1 } });
  });
});
