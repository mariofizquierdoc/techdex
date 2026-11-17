import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { toDateInput } from "@/lib/format";
import { updateItemAction } from "../../actions";
import { ItemForm } from "../../item-form";

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect(`/items/${id}`);

  const [item, categories] = await Promise.all([
    db.item.findUnique({ where: { id } }),
    db.category.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!item) notFound();
  const t = await getTranslations("items.form");

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("editTitle", { assetTag: item.assetTag })}</h1>
      <ItemForm
        isEdit
        action={updateItemAction.bind(null, item.id)}
        categories={categories}
        cancelHref={`/items/${item.id}`}
        defaults={{
          assetTag: item.assetTag,
          serialNumber: item.serialNumber ?? "",
          categoryId: item.categoryId,
          brand: item.brand ?? "",
          model: item.model ?? "",
          description: item.description,
          purchasePrice: item.purchasePriceCents != null ? (item.purchasePriceCents / 100).toFixed(2) : "",
          purchasedAt: toDateInput(item.purchasedAt),
        }}
      />
    </div>
  );
}
