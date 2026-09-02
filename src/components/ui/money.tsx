"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatDecimal } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Money always reads left-to-right, including inside an RTL page. */
export function Money({
  value,
  className,
  showUnit = true,
}: {
  value: string | number;
  className?: string;
  showUnit?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("common");

  return (
    <span dir="ltr" className={cn("tabular-nums", className)}>
      {formatDecimal(value, locale)}
      {showUnit && (
        <span className="ms-1 text-xs font-normal text-muted-foreground">
          {t("egp")}
        </span>
      )}
    </span>
  );
}

export function Measure({
  value,
  unit,
  className,
}: {
  value: string | number;
  unit: "tons" | "kg";
  className?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("common");

  return (
    <span dir="ltr" className={cn("tabular-nums", className)}>
      {formatDecimal(value, locale)}
      <span className="ms-1 text-xs font-normal text-muted-foreground">
        {t(unit)}
      </span>
    </span>
  );
}
