"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The icons are always visible. The previous `opacity-50
 * group-hover:opacity-100` pattern is invisible on touch devices, which have
 * no hover state at all.
 */
export function RowActions({
  viewHref,
  onEdit,
  onDelete,
  deleteDisabled,
}: {
  viewHref?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  deleteDisabled?: boolean;
}) {
  const t = useTranslations("common");

  return (
    <div className="flex items-center justify-center gap-1">
      {viewHref && (
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
        >
          <Link href={viewHref} aria-label={t("view")}>
            <Eye className="h-4 w-4" />
          </Link>
        </Button>
      )}
      {onEdit && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
          aria-label={t("edit")}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          disabled={deleteDisabled}
          className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
          aria-label={t("delete")}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
