"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

export function InfiniteScrollSpinner({
  loading,
  hasMore,
  loadMoreRef,
}: {
  loading: boolean;
  hasMore: boolean;
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
}) {
  const t = useTranslations("common");

  if (!hasMore) return null;

  return (
    <div ref={loadMoreRef} className="py-4 flex justify-center w-full md:hidden">
      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">{t("loading")}</span>
        </div>
      )}
    </div>
  );
}
