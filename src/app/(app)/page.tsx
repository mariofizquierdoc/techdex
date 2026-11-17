import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { ITEM_STATUSES, STATUS_CLASS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Timeline } from "./items/[id]/timeline";

export async function generateMetadata() {
  const t = await getTranslations("dashboard");
  return { title: t("title") };
}

export default async function DashboardPage() {
  await requireUser();
  const t = await getTranslations();
  const format = await getFormatter();

  const [byStatus, byCategory, categories, totalValue, people, recent] = await Promise.all([
    db.item.groupBy({ by: ["status"], _count: true }),
    db.item.groupBy({ by: ["categoryId"], _count: true }),
    db.category.findMany(),
    db.item.aggregate({ _sum: { purchasePriceCents: true }, where: { status: { not: "RETIRED" } } }),
    db.person.count({ where: { active: true } }),
    db.itemEvent.findMany({
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 8,
      include: {
        person: true,
        item: { select: { id: true, assetTag: true } },
        createdBy: { select: { name: true } },
      },
    }),
  ]);

  const statusCount = Object.fromEntries(byStatus.map((s) => [s.status, s._count]));
  const total = byStatus.reduce((n, s) => n + s._count, 0);
  const categoryName = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const categoryRows = byCategory
    .map((c) => ({ name: categoryName[c.categoryId] ?? "?", count: c._count }))
    .sort((a, b) => b.count - a.count);
  const maxCategory = Math.max(1, ...categoryRows.map((c) => c.count));

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("dashboard.title")}</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t("dashboard.totalItems")} value={format.number(total)} href="/items" />
        <Stat label={t("dashboard.activePeople")} value={format.number(people)} href="/people" />
        <Stat
          label={t("dashboard.valueInService")}
          value={format.number((totalValue._sum.purchasePriceCents ?? 0) / 100, "money")}
          hint={t("dashboard.valueHint")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ITEM_STATUSES.map((s) => (
          <Card key={s} size="sm">
            <CardContent className="flex items-center justify-between">
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_CLASS[s])}>{t(`status.${s}`)}</span>
              <span className="text-2xl font-semibold tabular-nums">{statusCount[s] ?? 0}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.byCategory")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {categoryRows.length === 0 && <p className="text-sm text-muted-foreground">{t("dashboard.noItems")}</p>}
            {categoryRows.map((c) => (
              <div key={c.name} className="grid gap-1 text-sm">
                <div className="flex justify-between">
                  <span>{c.name}</span>
                  <span className="tabular-nums text-muted-foreground">{c.count}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${(c.count / maxCategory) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.recentActivity")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline
              events={recent.map((e) => ({
                id: e.id,
                type: e.type,
                occurredAt: e.occurredAt,
                personId: e.personId,
                personName: e.person?.name ?? null,
                jobTitle: e.jobTitle,
                location: e.location,
                notes: e.notes,
                fromStatus: e.fromStatus,
                toStatus: e.toStatus,
                createdBy: e.createdBy.name,
                item: e.item,
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, href }: { label: string; value: React.ReactNode; hint?: string; href?: string }) {
  const body = (
    <Card className={href ? "transition-colors hover:bg-muted/50" : undefined}>
      <CardContent>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
