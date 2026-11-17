import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOutIcon, MonitorSmartphoneIcon } from "lucide-react";
import { signOut } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/authz";
import { NavLinks } from "./nav-links";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/logout");

  const links = [
    { href: "/", label: "Dashboard" },
    { href: "/items", label: "Items" },
    { href: "/people", label: "People" },
    ...(user.role === "ADMIN"
      ? [
          { href: "/settings/categories", label: "Categories" },
          { href: "/settings/users", label: "Users" },
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
            <Badge variant="outline">{user.role === "ADMIN" ? "Admin" : "Viewer"}</Badge>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button variant="ghost" size="icon-sm" type="submit" title="Sign out">
                <LogOutIcon />
                <span className="sr-only">Sign out</span>
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
