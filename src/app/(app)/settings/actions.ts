"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { AuthzError, requireAdmin } from "@/lib/authz";
import { runAction, type ActionState } from "@/lib/action";
import { db } from "@/lib/db";
import { DomainError, deleteCategory } from "@/lib/inventory";
import { ROLES } from "@/lib/labels";
import { categorySchema, formToObject, passwordSchema, userSchema } from "@/lib/validation";

// ---------- Categories ----------

export async function saveCategoryAction(
  categoryId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const state = await runAction(async () => {
    await requireAdmin();
    const data = categorySchema.parse(formToObject(formData));
    if (categoryId) await db.category.update({ where: { id: categoryId }, data });
    else await db.category.create({ data });
  }, categoryId ? "Category renamed" : "Category added");
  if (state.ok) revalidatePath("/", "layout");
  return state;
}

export async function deleteCategoryAction(categoryId: string): Promise<ActionState> {
  const state = await runAction(async () => {
    await requireAdmin();
    await deleteCategory(categoryId);
  }, "Category deleted");
  if (state.ok) revalidatePath("/", "layout");
  return state;
}

// ---------- Users ----------

async function assertNotLastAdmin(userId: string) {
  const target = await db.user.findUnique({ where: { id: userId } });
  if (target?.role === "ADMIN" && (await db.user.count({ where: { role: "ADMIN" } })) <= 1) {
    throw new DomainError("There must be at least one admin");
  }
}

export async function createUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const state = await runAction(async () => {
    await requireAdmin();
    const { password, ...data } = userSchema.parse(formToObject(formData));
    await db.user.create({ data: { ...data, passwordHash: await bcrypt.hash(password, 10) } });
  }, "User created");
  if (state.ok) revalidatePath("/settings/users");
  return state;
}

export async function setUserRoleAction(userId: string, role: string): Promise<ActionState> {
  const state = await runAction(async () => {
    await requireAdmin();
    const parsed = z.enum(ROLES).parse(role);
    if (parsed !== "ADMIN") await assertNotLastAdmin(userId);
    await db.user.update({ where: { id: userId }, data: { role: parsed } });
  }, "Role updated");
  if (state.ok) revalidatePath("/settings/users");
  return state;
}

export async function resetPasswordAction(userId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAdmin();
    const { password } = passwordSchema.parse(formToObject(formData));
    await db.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  }, "Password reset");
}

export async function deleteUserAction(userId: string): Promise<ActionState> {
  const state = await runAction(async () => {
    const me = await requireAdmin();
    if (me.id === userId) throw new AuthzError("You can't delete your own account");
    await assertNotLastAdmin(userId);
    const authored = await db.itemEvent.count({ where: { createdById: userId } });
    if (authored > 0) {
      throw new DomainError("This user recorded history events and can't be deleted. Change their role to Viewer instead.");
    }
    await db.user.delete({ where: { id: userId } });
  }, "User deleted");
  if (state.ok) revalidatePath("/settings/users");
  return state;
}
