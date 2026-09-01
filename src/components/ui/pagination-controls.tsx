"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const t = useTranslations("common");

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", page.toString());
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-4 border-t">
      <div className="text-sm text-muted-foreground flex items-center gap-2">
        <span>{t("total")}: {totalItems}</span>
      </div>
      <div className="flex items-center space-x-2 rtl:space-x-reverse">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="gap-1 px-3"
        >
          {/* "Previous" points back along the reading direction: left in
              LTR, right in RTL. */}
          <ChevronLeft className="h-4 w-4 rtl:hidden" />
          <ChevronRight className="h-4 w-4 hidden rtl:block" />
          <span className="hidden sm:inline">{t("previous")}</span>
        </Button>
        <div className="text-sm font-medium px-2 whitespace-nowrap">
          {t("page")} {currentPage} / {totalPages}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="gap-1 px-3"
        >
          <span className="hidden sm:inline">{t("next")}</span>
          <ChevronRight className="h-4 w-4 rtl:hidden" />
          <ChevronLeft className="h-4 w-4 hidden rtl:block" />
        </Button>
      </div>
    </div>
  );
}
