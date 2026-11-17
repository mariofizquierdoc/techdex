import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LogOutIcon, MonitorSmartphoneIcon } from "lucide-react";
import { signOut } from "@/auth";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/authz";
import { NavLinks } from "./nav-links";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/logout");
  const t = await getTranslations();

  const links = [
    { href: "/", label: t("nav.dashboard") },
    { href: "/items", label: t("nav.items") },
    { href: "/people", label: t("nav.people") },
    ...(user.role === "ADMIN"
      ? [
          { href: "/settings/categories", label: t("nav.categories") },
          { href: "/settings/users", label: t("nav.users") },
        ]
      : []),
  ];

  return (
    <div className="min-h-svh bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <MonitorSmartphoneIcon className="size-5" />
            techdex
          </Link>
          <NavLinks links={links} />
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{user.name}</span>
            <Badge variant="outline">{t(`role.${user.role}`)}</Badge>
            <LocaleSwitcher />
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button variant="ghost" size="icon-sm" type="submit" title={t("nav.signOut")}>
                <LogOutIcon />
                <span className="sr-only">{t("nav.signOut")}</span>
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
