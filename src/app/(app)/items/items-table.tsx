"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { EventType, ItemStatus } from "@prisma/client";
import { ArrowUpDownIcon, DownloadIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/format";
import { EVENT_LABEL, ITEM_STATUSES, STATUS_LABEL } from "@/lib/labels";

export type ItemRow = {
  id: string;
  assetTag: string;
  serialNumber: string | null;
  category: string;
  brandModel: string;
  description: string;
  assignee: string | null;
  jobTitle: string | null;
  location: string | null;
  status: ItemStatus;
  notes: string | null;
  lastEventAt: string | null;
  lastEventType: EventType | null;
};

const ALL = "__all";

function SortHeader({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="-ml-2.5" onClick={onClick}>
      {label}
      <ArrowUpDownIcon className="size-3.5 text-muted-foreground" />
    </Button>
  );
}

const columns: ColumnDef<ItemRow>[] = [
  {
    accessorKey: "assetTag",
    header: ({ column }) => <SortHeader label="Asset tag" onClick={() => column.toggleSorting()} />,
    cell: ({ row }) => (
      <Link href={`/items/${row.original.id}`} className="font-mono font-medium hover:underline">
        {row.original.assetTag}
      </Link>
    ),
  },
  {
    accessorKey: "category",
    header: ({ column }) => <SortHeader label="Category" onClick={() => column.toggleSorting()} />,
  },
  {
    id: "item",
    accessorFn: (r) => `${r.brandModel} ${r.description}`,
    header: ({ column }) => <SortHeader label="Item" onClick={() => column.toggleSorting()} />,
    cell: ({ row }) => (
      <div className="max-w-64">
        <div className="truncate font-medium">{row.original.brandModel || row.original.description}</div>
        {row.original.brandModel && (
          <div className="truncate text-xs text-muted-foreground">{row.original.description}</div>
        )}
      </div>
    ),
  },
  {
    accessorKey: "assignee",
    header: ({ column }) => <SortHeader label="Assignee" onClick={() => column.toggleSorting()} />,
    cell: ({ row }) =>
      row.original.assignee ? (
        <div>
          <div>{row.original.assignee}</div>
          {row.original.jobTitle && <div className="text-xs text-muted-foreground">{row.original.jobTitle}</div>}
        </div>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: "location",
    header: ({ column }) => <SortHeader label="Location" onClick={() => column.toggleSorting()} />,
    cell: ({ getValue }) => (getValue() as string | null) ?? <span className="text-muted-foreground">—</span>,
  },
  {
    accessorKey: "status",
    header: ({ column }) => <SortHeader label="Status" onClick={() => column.toggleSorting()} />,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "notes",
    header: "Condition",
    enableSorting: false,
    cell: ({ getValue }) => (
      <div className="max-w-56 truncate text-muted-foreground" title={(getValue() as string) ?? ""}>
        {(getValue() as string | null) ?? "—"}
      </div>
    ),
  },
  {
    accessorKey: "lastEventAt",
    header: ({ column }) => <SortHeader label="Last event" onClick={() => column.toggleSorting()} />,
    cell: ({ row }) =>
      row.original.lastEventAt ? (
        <div className="whitespace-nowrap">
          <div>{formatDate(row.original.lastEventAt)}</div>
          <div className="text-xs text-muted-foreground">{EVENT_LABEL[row.original.lastEventType!]}</div>
        </div>
      ) : (
        "—"
      ),
  },
];

function toCsv(rows: ItemRow[]): string {
  const header = ["Asset tag", "Serial", "Category", "Brand/model", "Description", "Assignee", "Job title", "Location", "Status", "Condition", "Last event"];
  const esc = (v: string | null) => `"${(v ?? "").replaceAll('"', '""')}"`;
  const lines = rows.map((r) =>
    [r.assetTag, r.serialNumber, r.category, r.brandModel, r.description, r.assignee, r.jobTitle, r.location, STATUS_LABEL[r.status], r.notes, r.lastEventAt?.slice(0, 10) ?? null]
      .map(esc)
      .join(","),
  );
  return [header.map(esc).join(","), ...lines].join("\r\n");
}

export function ItemsTable({ rows, categories }: { rows: ItemRow[]; categories: string[] }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState(ALL);
  const [status, setStatus] = React.useState(ALL);
  const [location, setLocation] = React.useState(ALL);
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const locations = React.useMemo(
    () => [...new Set(rows.map((r) => r.location).filter((l): l is string => !!l))].sort(),
    [rows],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (category !== ALL && r.category !== category) return false;
      if (status !== ALL && r.status !== status) return false;
      if (location !== ALL && r.location !== location) return false;
      if (!q) return true;
      return [r.assetTag, r.serialNumber, r.brandModel, r.description, r.assignee, r.jobTitle, r.location, r.notes]
        .some((v) => v?.toLowerCase().includes(q));
    });
  }, [rows, query, category, status, location]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  function exportCsv() {
    const blob = new Blob([toCsv(table.getRowModel().rows.map((r) => r.original))], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `techdex-items-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tag, serial, person, notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <FilterSelect value={category} onChange={setCategory} placeholder="All categories" options={categories.map((c) => [c, c])} />
        <FilterSelect value={status} onChange={setStatus} placeholder="All statuses" options={ITEM_STATUSES.map((s) => [s, STATUS_LABEL[s]])} />
        <FilterSelect value={location} onChange={setLocation} placeholder="All locations" options={locations.map((l) => [l, l])} />
        <Button variant="outline" className="ml-auto" onClick={exportCsv} disabled={filtered.length === 0}>
          <DownloadIcon /> Export CSV
        </Button>
      </div>

      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {rows.length === 0 ? "No items yet." : "No items match these filters."}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("a,button")) return;
                    router.push(`/items/${row.original.id}`);
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {rows.length}
      </p>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: [string, string][];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-40">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map(([v, label]) => (
          <SelectItem key={v} value={v}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
