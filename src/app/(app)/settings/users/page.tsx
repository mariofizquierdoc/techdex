import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { CreateUserDialog, DeleteUserButton, ResetPasswordDialog, RoleSelect } from "./user-controls";

export async function generateMetadata() {
  const t = await getTranslations("users");
  return { title: t("title") };
}

export default async function UsersPage() {
  const me = await requireUser();
  if (me.role !== "ADMIN") redirect("/");
  const t = await getTranslations("users");
  const format = await getFormatter();
  const users = await db.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <CreateUserDialog />
      </div>
      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("nameCol")}</TableHead>
              <TableHead>{t("emailCol")}</TableHead>
              <TableHead>{t("roleCol")}</TableHead>
              <TableHead>{t("createdCol")}</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">
                  {u.name}
                  {u.id === me.id && <span className="ml-1.5 text-xs text-muted-foreground">{t("you")}</span>}
                </TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <RoleSelect userId={u.id} role={u.role} disabled={u.id === me.id} />
                </TableCell>
                <TableCell>{format.dateTime(u.createdAt, "short")}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <ResetPasswordDialog user={{ id: u.id, name: u.name }} />
                    {u.id !== me.id && <DeleteUserButton user={{ id: u.id, name: u.name }} />}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
