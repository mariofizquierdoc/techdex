import { redirect } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { toDateInput } from "@/lib/format";
import { createItemAction } from "../actions";
import { ItemForm } from "../item-form";

export const metadata = { title: "New item" };

export default async function NewItemPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/items");
  const categories = await db.category.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">New item</h1>
      <ItemForm
        action={createItemAction}
        categories={categories}
        defaults={{ purchasedAt: toDateInput(new Date()) }}
        cancelHref="/items"
      />
    </div>
  );
}
