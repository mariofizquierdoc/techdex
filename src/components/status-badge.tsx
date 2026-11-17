import type { ItemStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/labels";

export function StatusBadge({ status }: { status: ItemStatus }) {
  return (
    <Badge variant="secondary" className={STATUS_CLASS[status]}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
