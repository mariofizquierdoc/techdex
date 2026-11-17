import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeftIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { Timeline } from "../../items/[id]/timeline";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await db.person.findUnique({ where: { id }, select: { name: true } });
  return { title: p?.name ?? "Person" };
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();

  const person = await db.person.findUnique({
    where: { id },
    include: {
      items: { orderBy: { assetTag: "asc" }, include: { category: true } },
      events: {
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        include: { item: { select: { id: true, assetTag: true } }, createdBy: { select: { name: true } } },
      },
    },
  });
  if (!person) notFound();
  const t = await getTranslations("people");

  return (
    <div className="grid gap-6">
      <div>
        <Link href="/people" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" /> {t("allPeople")}
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{person.name}</h1>
          {!person.active && <Badge variant="outline">{t("inactive")}</Badge>}
        </div>
        <p className="text-muted-foreground">{person.email}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t("holding", { count: person.items.length })}</CardTitle>
          </CardHeader>
          <CardContent>
            {person.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noItems")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("assetTag")}</TableHead>
                    <TableHead>{t("item")}</TableHead>
                    <TableHead>{t("position")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {person.items.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>
                        <Link href={`/items/${i.id}`} className="font-mono font-medium hover:underline">
                          {i.assetTag}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div>{[i.brand, i.model].filter(Boolean).join(" ") || i.description}</div>
                        <div className="text-xs text-muted-foreground">{i.category.name}</div>
                      </TableCell>
                      <TableCell>{[i.jobTitle, i.location].filter(Boolean).join(" · ") || "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={i.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("history")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline
              events={person.events.map((e) => ({
                id: e.id,
                type: e.type,
                occurredAt: e.occurredAt,
                personId: null,
                personName: person.name,
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
