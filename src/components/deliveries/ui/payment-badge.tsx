"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<string, string> = {
  paid: "bg-status-paid text-status-paid-foreground",
  partial: "bg-status-partial text-status-partial-foreground",
  unpaid: "bg-status-unpaid text-status-unpaid-foreground",
};

export function PaymentBadge({ status }: { status: string | null }) {
  const t = useTranslations("deliveries");
  const value = status ?? "unpaid";
  return (
    <Badge className={cn("border-transparent", STATUS_CLASS[value] ?? STATUS_CLASS.unpaid)}>
      {t(value)}
    </Badge>
  );
}
