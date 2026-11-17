"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authz";
import { runAction, type ActionState } from "@/lib/action";
import { db } from "@/lib/db";
import { setPersonActive } from "@/lib/inventory";
import { formToObject, personSchema } from "@/lib/validation";

export async function savePersonAction(
  personId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const state = await runAction(
    async () => {
      await requireAdmin();
      const data = personSchema.parse(formToObject(formData));
      if (personId) await db.person.update({ where: { id: personId }, data });
      else await db.person.create({ data });
    },
    personId ? "Person updated" : "Person added",
  );
  if (state.ok) {
    revalidatePath("/people", "layout");
    revalidatePath("/items", "layout");
  }
  return state;
}

export async function setPersonActiveAction(personId: string, active: boolean): Promise<ActionState> {
  const state = await runAction(
    async () => {
      await requireAdmin();
      await setPersonActive(personId, active);
    },
    active ? "Person reactivated" : "Person deactivated",
  );
  if (state.ok) revalidatePath("/people", "layout");
  return state;
}
