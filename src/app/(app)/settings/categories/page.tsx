import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { CategoryDialog, DeleteCategoryButton } from "./category-controls";

export async function generateMetadata() {
  const t = await getTranslations("categories");
  return { title: t("title") };
}

export default async function CategoriesPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  const t = await getTranslations("categories");
  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { items: true } } },
  });

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <CategoryDialog />
      </div>
      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("nameCol")}</TableHead>
              <TableHead className="text-right">{t("items")}</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-right tabular-nums">{c._count.items}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <CategoryDialog category={{ id: c.id, name: c.name }} />
                    <DeleteCategoryButton category={{ id: c.id, name: c.name }} disabled={c._count.items > 0} />
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
