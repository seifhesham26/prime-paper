"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { cn } from "@/lib/utils";
import { ALIGN_CLASS, type Column } from "./types";
import { buildListParams, nextSortDir, parseListParams } from "./list-params";

export function DataTable<T>({
  columns,
  rows,
  isLoading,
  emptyState,
  getRowKey,
  pagination,
}: {
  columns: Column<T>[];
  rows: T[];
  isLoading: boolean;
  emptyState: ReactNode;
  getRowKey: (row: T) => string;
  pagination?: { currentPage: number; totalPages: number; totalItems: number };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("common");

  const sortKeys = columns.flatMap((c) => (c.sortKey ? [c.sortKey] : []));
  const state = parseListParams(searchParams, sortKeys);

  const toggleSort = (key: string) => {
    const patch = nextSortDir(state, key);
    const next = buildListParams(searchParams, patch);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  if (isLoading) {
    return (
      <Card className="overflow-hidden p-0">
        <CardContent className="p-0">
          <TableSkeleton columns={columns.length} />
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-0">{emptyState}</CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <CardContent className="p-0">
        {/* Desktop: dense table with a sticky header. */}
        <div className="hidden md:block">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
              <TableRow className="hover:bg-transparent">
                {columns.map((col) => {
                  const active = col.sortKey && state.sortBy === col.sortKey;
                  const Icon = !col.sortKey
                    ? null
                    : !active
                      ? ChevronsUpDown
                      : state.sortDir === "asc"
                        ? ArrowUp
                        : ArrowDown;

                  return (
                    <TableHead
                      key={col.id}
                      className={cn(
                        "font-semibold",
                        ALIGN_CLASS[col.align ?? "start"],
                      )}
                    >
                      {col.sortKey ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(col.sortKey!)}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          aria-label={
                            !active
                              ? t("sortAscending")
                              : state.sortDir === "asc"
                                ? t("sortDescending")
                                : t("clearSort")
                          }
                        >
                          {col.header}
                          {Icon && (
                            <Icon
                              className={cn(
                                "h-3.5 w-3.5",
                                active ? "text-foreground" : "text-muted-foreground/50",
                              )}
                            />
                          )}
                        </button>
                      ) : (
                        col.header
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={getRowKey(row)} className="group">
                  {columns.map((col) => (
                    <TableCell
                      key={col.id}
                      className={ALIGN_CLASS[col.align ?? "start"]}
                    >
                      {col.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile: one card per row, label and value paired. */}
        <div className="divide-y divide-border md:hidden">
          {rows.map((row) => (
            <div key={getRowKey(row)} className="space-y-2 p-4">
              {columns
                .filter((col) => !col.hideOnMobile)
                .map((col) => (
                  <div
                    key={col.id}
                    className="flex items-start justify-between gap-4"
                  >
                    <span className="text-xs font-medium text-muted-foreground">
                      {col.header}
                    </span>
                    <span className="text-end text-sm">{col.cell(row)}</span>
                  </div>
                ))}
            </div>
          ))}
        </div>

        {pagination && pagination.totalPages > 1 && (
          <PaginationControls {...pagination} />
        )}
      </CardContent>
    </Card>
  );
}
