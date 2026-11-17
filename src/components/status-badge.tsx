import type { ItemStatus } from "@prisma/client";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { STATUS_CLASS } from "@/lib/labels";

// No "use client": next-intl's useTranslations also works in server components.
export function StatusBadge({ status }: { status: ItemStatus }) {
  const t = useTranslations("status");
  return (
    <Badge variant="secondary" className={STATUS_CLASS[status]}>
      {t(status)}
    </Badge>
  );
}
