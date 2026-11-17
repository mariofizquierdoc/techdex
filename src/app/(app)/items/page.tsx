import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { ItemsTable, type ItemRow } from "./items-table";

export async function generateMetadata() {
  const t = await getTranslations("items");
  return { title: t("title") };
}

export default async function ItemsPage() {
  const user = await requireUser();
  const t = await getTranslations("items");
  const [items, categories] = await Promise.all([
    db.item.findMany({
      orderBy: { assetTag: "asc" },
      include: {
        category: true,
        assignee: true,
        events: { orderBy: { occurredAt: "desc" }, take: 1, select: { occurredAt: true, type: true } },
      },
    }),
    db.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  const rows: ItemRow[] = items.map((i) => ({
    id: i.id,
    assetTag: i.assetTag,
    serialNumber: i.serialNumber,
    category: i.category.name,
    brandModel: [i.brand, i.model].filter(Boolean).join(" "),
    description: i.description,
    assignee: i.assignee?.name ?? null,
    jobTitle: i.jobTitle,
    location: i.location,
    status: i.status,
    notes: i.notes,
    lastEventAt: i.events[0]?.occurredAt.toISOString() ?? null,
    lastEventType: i.events[0]?.type ?? null,
  }));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("count", { count: items.length })}</p>
        </div>
        {user.role === "ADMIN" && (
          <Button asChild>
            <Link href="/items/new">
              <PlusIcon /> {t("newItem")}
            </Link>
          </Button>
        )}
      </div>
      <ItemsTable rows={rows} categories={categories.map((c) => c.name)} />
    </div>
  );
}
