"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Languages } from "lucide-react";
import { UserSettingsClient } from "@/components/settings/ui/user-settings-client";
import { SystemConfigClient } from "@/components/settings/ui/system-config-client";
import { DashboardCardEditor } from "@/components/settings/ui/dashboard-card-editor";
import { useUserRole } from "@/hooks/use-role";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const { canWrite } = useUserRole();

  // The dashboard links to /settings?tab=cards; without this the link
  // always landed on the Account tab.
  const searchParams = useSearchParams();
  const requested = searchParams.get("tab");
  const validTabs = ["account", "global", "config", "cards"];
  const initialTab = requested && validTabs.includes(requested) ? requested : "account";

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
      <div className="p-4 sm:p-6 w-full max-w-4xl mx-auto animate-in fade-in duration-500">
        <Tabs defaultValue={initialTab} className="w-full">
          <div className="mb-6 border-b border-border/50 pb-2 overflow-x-auto no-scrollbar">
            <TabsList className="bg-transparent gap-2 w-max min-w-full justify-start p-0">
              <TabsTrigger 
                value="account" 
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-4 py-2.5 rounded-full"
              >
                {t("account") || "Account Setup"}
              </TabsTrigger>
              <TabsTrigger 
                value="global" 
                className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-4 py-2.5 rounded-full"
              >
                {t("systemAndLanguage")}
              </TabsTrigger>
              {canWrite && (
                <TabsTrigger 
                  value="config" 
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-4 py-2.5 rounded-full"
                >
                  {t("systemConfig")}
                </TabsTrigger>
              )}
              {canWrite && (
                <TabsTrigger 
                  value="cards" 
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-4 py-2.5 rounded-full"
                >
                  {t("dashboardCards")}
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <TabsContent value="account" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <UserSettingsClient />
          </TabsContent>

          <TabsContent value="global" className="mt-0 space-y-6">
            <Card className="shadow-md">
              <CardHeader className="bg-muted/30 border-b border-muted">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Languages className="h-5 w-5 text-muted-foreground" />
                  {t("language")}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
                  <div className="space-y-1">
                    <h4 className="font-medium">{t("systemLanguage")}</h4>
                    <p className="text-sm text-muted-foreground">{t("systemLanguageDesc")}</p>
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
          </TabsContent>

          {canWrite && (
            <TabsContent value="config" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <SystemConfigClient />
            </TabsContent>
          )}

          {canWrite && (
            <TabsContent value="cards" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <DashboardCardEditor />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </>
  );
}
