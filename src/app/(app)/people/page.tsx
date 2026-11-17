import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { PersonDialog, ToggleActiveButton } from "./person-dialog";

export const metadata = { title: "People" };

export default async function PeoplePage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const people = await db.person.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      _count: { select: { items: true } },
      events: {
        where: { type: "ASSIGNED" },
        orderBy: { occurredAt: "desc" },
        take: 1,
        select: { jobTitle: true, location: true },
      },
    },
  });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">People</h1>
          <p className="text-sm text-muted-foreground">Everyone who can be assigned equipment.</p>
        </div>
        {isAdmin && <PersonDialog />}
      </div>

      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Last known position</TableHead>
              <TableHead className="text-right">Items held</TableHead>
              <TableHead>Status</TableHead>
              {isAdmin && <TableHead className="w-0" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No people yet.
                </TableCell>
              </TableRow>
            )}
            {people.map((p) => (
              <TableRow key={p.id} className={p.active ? "" : "text-muted-foreground"}>
                <TableCell>
                  <Link href={`/people/${p.id}`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                </TableCell>
                <TableCell>{p.email}</TableCell>
                <TableCell>
                  {[p.events[0]?.jobTitle, p.events[0]?.location].filter(Boolean).join(" · ") || "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{p._count.items}</TableCell>
                <TableCell>
                  {p.active ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <PersonDialog person={{ id: p.id, name: p.name, email: p.email }} />
                      <ToggleActiveButton person={p} />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
