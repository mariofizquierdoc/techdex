import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ArrowLeftIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { ItemActions } from "./item-actions";
import { Timeline } from "./timeline";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await db.item.findUnique({ where: { id }, select: { assetTag: true } });
  return { title: item?.assetTag ?? "Item" };
}

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const t = await getTranslations("items");
  const tc = await getTranslations("common");
  const format = await getFormatter();

  const item = await db.item.findUnique({
    where: { id },
    include: {
      category: true,
      assignee: true,
      events: {
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        include: { person: true, createdBy: { select: { name: true } } },
      },
    },
  });
  if (!item) notFound();

  // Active people + their most recent job title / location, to prefill the assign dialog.
  const people = isAdmin
    ? await db.person.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        include: {
          events: {
            where: { type: "ASSIGNED" },
            orderBy: { occurredAt: "desc" },
            take: 1,
            select: { jobTitle: true, location: true },
          },
        },
      })
    : [];

  const details: [string, React.ReactNode][] = [
    [t("detail.category"), item.category.name],
    [t("detail.brandModel"), [item.brand, item.model].filter(Boolean).join(" ") || tc("none")],
    [t("detail.serialNumber"), item.serialNumber ?? tc("none")],
    [t("detail.purchaseDate"), item.purchasedAt ? format.dateTime(item.purchasedAt, "short") : tc("none")],
    [t("detail.purchasePrice"), item.purchasePriceCents != null ? format.number(item.purchasePriceCents / 100, "money") : tc("none")],
  ];

  return (
    <div className="grid gap-6">
      <div>
        <Link href="/items" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" /> {t("allItems")}
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-2xl font-semibold tracking-tight">{item.assetTag}</h1>
              <StatusBadge status={item.status} />
            </div>
            <p className="text-muted-foreground">{item.description}</p>
          </div>
          {isAdmin && (
            <ItemActions
              item={{ id: item.id, assetTag: item.assetTag, status: item.status, assigneeName: item.assignee?.name ?? null }}
              people={people.map((p) => ({
                id: p.id,
                name: p.name,
                jobTitle: p.events[0]?.jobTitle ?? "",
                location: p.events[0]?.location ?? "",
              }))}
            />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("detail.currentAssignment")}</CardTitle>
            </CardHeader>
            <CardContent>
              {item.assignee ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">{t("detail.assignee")}</dt>
                  <dd>
                    <Link href={`/people/${item.assignee.id}`} className="font-medium hover:underline">
                      {item.assignee.name}
                    </Link>
                  </dd>
                  <dt className="text-muted-foreground">{t("detail.jobTitle")}</dt>
                  <dd>{item.jobTitle ?? tc("none")}</dd>
                  <dt className="text-muted-foreground">{t("detail.location")}</dt>
                  <dd>{item.location ?? tc("none")}</dd>
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">{t("detail.notAssigned")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("detail.condition")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{item.notes || <span className="text-muted-foreground">{t("detail.noNotes")}</span>}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("detail.details")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                {details.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("detail.history")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline
              events={item.events.map((e) => ({
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
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
