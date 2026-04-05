"use client";

import { useLocale, useTranslations } from "next-intl";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";

export function Header({ title }: { title: string }) {
  const t = useTranslations("settings");
  const locale = useLocale();

  const toggleLanguage = () => {
    const newLocale = locale === "ar" ? "en" : "ar";
    document.cookie = `locale=${newLocale};path=/;max-age=31536000`;
    window.location.reload();
  };

  return (
    <header className="flex h-14 items-center gap-3 border-b px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />
      <h2 className="flex-1 text-lg font-semibold">{title}</h2>
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleLanguage}
        className="gap-2"
      >
        <Languages className="h-4 w-4" />
        <span className="text-xs">
          {locale === "en" ? t("arabic") : t("english")}
        </span>
      </Button>
    </header>
  );
}
