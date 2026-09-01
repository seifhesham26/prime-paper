"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { api } from "@/trpc/react";
import { SETTINGS_BY_KEY } from "@/server/settings/registry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, Settings2 } from "lucide-react";

export function SystemConfigClient() {
  const t = useTranslations("settings");
  const locale = useLocale();
  const isArabic = locale === "ar";
  const { data: settings, isLoading } = api.settings.getAll.useQuery();
  const utils = api.useUtils();

  const updateMutation = api.settings.update.useMutation({
    onSuccess: () => {
      utils.settings.getAll.invalidate();
      utils.analytics.getDashboardStats.invalidate();
      utils.analytics.evaluateCards.invalidate();
    },
    onError: (err) => alert(err.message),
  });

  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const handleSave = async (key: string) => {
    const value = editedValues[key];
    if (value === undefined) return;
    setSavingKey(key);
    try {
      await updateMutation.mutateAsync({ key, value });
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 2000);
      // Remove from edited state
      setEditedValues((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch {
      // Rejected by range validation; onError reported it and the edited
      // value stays in the box so it can be corrected.
    } finally {
      setSavingKey(null);
    }
  };

  if (isLoading) {
    return (
      <div className="py-10 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  // Group settings by category
  const grouped = (settings || []).reduce<Record<string, typeof settings>>(
    (acc, setting) => {
      const cat = setting.category || "other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat]!.push(setting);
      return acc;
    },
    {}
  );

  const categoryLabels: Record<string, string> = {
    dashboard: "Dashboard",
    operational: "Operational",
    ui: "UI",
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-muted-foreground" />
          {t("systemConfig")}
        </h3>
        <p className="text-sm text-muted-foreground">{t("systemConfigDesc")}</p>
      </div>

      {Object.entries(grouped).map(([category, items]) => (
        <Card
          key={category}
          className="border-0 shadow-md bg-card/50 overflow-hidden"
        >
          <CardHeader className="bg-muted/30 border-b border-muted py-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {categoryLabels[category] || category}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {items?.map((setting) => {
                const isEdited = editedValues[setting.key] !== undefined;
                const currentValue =
                  editedValues[setting.key] ?? setting.value;
                const isSaving = savingKey === setting.key;
                const isSaved = savedKey === setting.key;

                return (
                  <div
                    key={setting.key}
                    className="flex flex-col sm:flex-row items-start sm:items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium block">
                        {isArabic
                          ? (SETTINGS_BY_KEY.get(setting.key)?.labelAr ?? setting.key)
                          : (SETTINGS_BY_KEY.get(setting.key)?.label ?? setting.key)}
                      </span>
                      <code className="text-xs font-mono text-muted-foreground">
                        {setting.key}
                      </code>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Input
                        value={currentValue}
                        onChange={(e) =>
                          setEditedValues((prev) => ({
                            ...prev,
                            [setting.key]: e.target.value,
                          }))
                        }
                        className="w-full sm:w-[140px] h-8 text-sm bg-muted/50 focus-visible:ring-primary/50"
                        dir="ltr"
                      />
                      <Button
                        size="sm"
                        variant={isSaved ? "default" : "outline"}
                        className="h-8 px-3 text-xs shrink-0 transition-all"
                        disabled={!isEdited || isSaving}
                        onClick={() => handleSave(setting.key)}
                      >
                        {isSaving ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : isSaved ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            {t("saved")}
                          </>
                        ) : (
                          t("save")
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
