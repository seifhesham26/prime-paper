"use client";

import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Languages, Settings } from "lucide-react";
import { UserSettingsClient } from "@/components/settings/ui/user-settings-client";

export default function SettingsPage() {
  const t = useTranslations("settings");

  const toggleLanguage = () => {
    const currentLocale =
      document.cookie
        .split("; ")
        .find((row) => row.startsWith("locale="))
        ?.split("=")[1] || "ar";

    const newLocale = currentLocale === "ar" ? "en" : "ar";
    document.cookie = `locale=${newLocale};path=/;max-age=31536000`;
    window.location.reload();
  };

  return (
    <>
      <Header title={t("title")} />
      <div className="p-6 space-y-6 max-w-2xl animate-in fade-in duration-500">
        <Card className="border-0 shadow-md bg-card/50">
          <CardHeader className="bg-muted/30 border-b border-muted">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Languages className="h-5 w-5 text-muted-foreground" />
              {t("language")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
              <div className="space-y-1">
                <h4 className="font-medium">System Language</h4>
                <p className="text-sm text-muted-foreground">Select your preferred language for the interface.</p>
              </div>
              <Button 
                variant="outline" 
                onClick={toggleLanguage}
                className="gap-2 shadow-sm hover:shadow-md transition-all sm:min-w-[150px]"
              >
                <Languages className="h-4 w-4" />
                {t("arabic")} / {t("english")}
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <UserSettingsClient />
      </div>
    </>
  );
}
