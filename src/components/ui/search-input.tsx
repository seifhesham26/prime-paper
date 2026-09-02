"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { buildListParams } from "@/components/ui/data-table/list-params";

export function SearchInput({ placeholder }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("common");

  const urlValue = searchParams.get("search") ?? "";
  const [value, setValue] = useState(urlValue);

  // Keeps the box in step with back/forward navigation. Adjusting during
  // render rather than in an effect: an effect-based sync renders once with
  // the stale value and then again with the corrected one, which is what
  // react-hooks/set-state-in-effect warns about.
  const [syncedUrlValue, setSyncedUrlValue] = useState(urlValue);
  if (urlValue !== syncedUrlValue) {
    setSyncedUrlValue(urlValue);
    setValue(urlValue);
  }

  useEffect(() => {
    if (value === urlValue) return;
    const id = setTimeout(() => {
      const next = buildListParams(searchParams, { search: value });
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(id);
  }, [value, urlValue, pathname, router, searchParams]);

  return (
    <div className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder ?? t("search")}
        className="ps-9 pe-9"
        aria-label={placeholder ?? t("search")}
      />
      {value && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute end-1 top-1/2 h-7 w-7 -translate-y-1/2"
          onClick={() => setValue("")}
          aria-label={t("cancel")}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
