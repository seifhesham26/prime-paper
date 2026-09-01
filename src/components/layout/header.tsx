"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Languages } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";

export function Header({
  title,
  breadcrumb,
}: {
  title: string;
  breadcrumb?: { href: string; label: string };
}) {
  const t = useTranslations("settings");
  const locale = useLocale();
  const router = useRouter();

  const toggleLanguage = () => {
    const newLocale = locale === "ar" ? "en" : "ar";
    document.cookie = `locale=${newLocale};path=/;max-age=31536000`;
    // The locale is read from this cookie by a server component, so a refresh
    // re-renders <html lang dir> without discarding scroll or client state.
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />

      <div className="flex min-w-0 flex-1 items-center gap-2">
        {breadcrumb && (
          <>
            <Link
              href={breadcrumb.href}
              className="truncate text-sm text-muted-foreground hover:text-foreground"
            >
              {breadcrumb.label}
            </Link>
            {/* The separator points along the reading direction. */}
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground rtl:hidden" />
            <ChevronLeft className="hidden h-4 w-4 shrink-0 text-muted-foreground rtl:block" />
          </>
        )}
        <h2 className="truncate text-lg font-semibold">{title}</h2>
      </div>

      <Button variant="ghost" size="sm" onClick={toggleLanguage} className="gap-2">
        <Languages className="h-4 w-4" />
        <span className="text-xs">{locale === "en" ? t("arabic") : t("english")}</span>
      </Button>
      <ThemeToggle />
      <UserMenu />
    </header>
  );
}
