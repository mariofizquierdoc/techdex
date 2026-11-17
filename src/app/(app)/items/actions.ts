"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/authz";
import { runAction, type ActionState } from "@/lib/action";
import * as inventory from "@/lib/inventory";
import {
  assignSchema,
  formToObject,
  itemSchema,
  noteSchema,
  repairSchema,
  statusSchema,
  unassignSchema,
} from "@/lib/validation";

function revalidateItem(itemId: string) {
  revalidatePath("/items");
  revalidatePath(`/items/${itemId}`);
  revalidatePath("/people", "layout");
  revalidatePath("/");
}

export async function createItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id = "";
  const state = await runAction(async () => {
    const user = await requireAdmin();
    const item = await inventory.createItem(itemSchema.parse(formToObject(formData)), user.id);
    id = item.id;
  });
  if (!state.ok) return state;
  revalidateItem(id);
  redirect(`/items/${id}`);
}

export async function updateItemAction(itemId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const state = await runAction(async () => {
    await requireAdmin();
    await inventory.updateItem(itemId, itemSchema.omit({ notes: true }).parse(formToObject(formData)));
  });
  if (!state.ok) return state;
  revalidateItem(itemId);
  redirect(`/items/${itemId}`);
}

export async function deleteItemAction(itemId: string): Promise<ActionState> {
  const state = await runAction(async () => {
    await requireAdmin();
    await inventory.deleteItem(itemId);
  }, "itemDeleted");
  if (!state.ok) return state;
  revalidateItem(itemId);
  redirect("/items");
}

export async function assignItemAction(itemId: string, _prev: ActionState, formData: FormData) {
  const state = await runAction(async () => {
    const user = await requireAdmin();
    await inventory.assignItem(itemId, assignSchema.parse(formToObject(formData)), user.id);
  }, "itemAssigned");
  if (state.ok) revalidateItem(itemId);
  return state;
}

export async function unassignItemAction(itemId: string, _prev: ActionState, formData: FormData) {
  const state = await runAction(async () => {
    const user = await requireAdmin();
    await inventory.unassignItem(itemId, unassignSchema.parse(formToObject(formData)), user.id);
  }, "itemReturned");
  if (state.ok) revalidateItem(itemId);
  return state;
}

export async function recordRepairAction(itemId: string, _prev: ActionState, formData: FormData) {
  const state = await runAction(async () => {
    const user = await requireAdmin();
    await inventory.recordRepair(itemId, repairSchema.parse(formToObject(formData)), user.id);
  }, "repairRecorded");
  if (state.ok) revalidateItem(itemId);
  return state;
}

export async function changeStatusAction(itemId: string, _prev: ActionState, formData: FormData) {
  const state = await runAction(async () => {
    const user = await requireAdmin();
    await inventory.changeStatus(itemId, statusSchema.parse(formToObject(formData)), user.id);
  }, "statusUpdated");
  if (state.ok) revalidateItem(itemId);
  return state;
}

export async function addNoteAction(itemId: string, _prev: ActionState, formData: FormData) {
  const state = await runAction(async () => {
    const user = await requireAdmin();
    await inventory.addNote(itemId, noteSchema.parse(formToObject(formData)), user.id);
  }, "noteAdded");
  if (state.ok) revalidateItem(itemId);
  return state;
}
