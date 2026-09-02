import type { ReactNode } from "react";

export type ColumnAlign = "start" | "center" | "end";

export type Column<T> = {
  /** Stable identity for React keys and for the mobile card label. */
  id: string;
  /** Already-translated header text. */
  header: string;
  align?: ColumnAlign;
  /**
   * Server-side sort key. Omit to make the column unsortable. Must match one
   * of the domain's `sortBy` enum values in `src/server/<domain>/types.ts`.
   */
  sortKey?: string;
  /** Dropped from the stacked card layout below `md`. */
  hideOnMobile?: boolean;
  cell: (row: T) => ReactNode;
};

export const ALIGN_CLASS: Record<ColumnAlign, string> = {
  start: "text-start",
  center: "text-center",
  end: "text-end",
};
