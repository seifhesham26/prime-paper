"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { authClient, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Lock, Loader2, Check } from "lucide-react";

export function UserSettingsClient() {
  const t = useTranslations("settings");
  const { data: session, isPending: isSessionLoading } = useSession();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const res = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false
      });

      if (res.error) {
         setError(t("passwordError") || res.error.message || "Error");
      } else {
        setSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
      }
    } catch {
      setError(t("passwordError"));
    } finally {
      setLoading(false);
    }
  };

  if (isSessionLoading) {
    return (
      <Card className="border-0 shadow-md bg-card/50">
        <CardContent className="h-[200px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
        </CardContent>
      </Card>
    );
  }

  if (!session?.user) {
    return (
      <Card className="border-0 shadow-md bg-card/50">
        <CardContent className="h-[200px] flex items-center justify-center text-muted-foreground">
          Unable to load user profile.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-md bg-card/50">
        <CardHeader className="bg-muted/30 border-b border-muted">
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5 text-muted-foreground" />
            {t("profileInfo")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground">{t("name")}</Label>
            <Input
              value={session.user.name}
              readOnly
              className="bg-muted/50 text-muted-foreground cursor-not-allowed border-none"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">{t("email")}</Label>
            <Input
              value={session.user.email}
              readOnly
              dir="ltr"
              className="bg-muted/50 text-muted-foreground cursor-not-allowed border-none"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md bg-card/50">
        <CardHeader className="bg-muted/30 border-b border-muted">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-5 w-5 text-muted-foreground" />
            {t("changePassword")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword" className="text-muted-foreground">{t("currentPassword")}</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                dir="ltr"
                className="bg-background focus-visible:ring-primary/50 transition-shadow"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-muted-foreground">{t("newPassword")}</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                dir="ltr"
                className="bg-background focus-visible:ring-primary/50 transition-shadow"
              />
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg py-3 px-4 flex items-center gap-2 shadow-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg py-3 px-4 flex items-center gap-2 shadow-sm dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400">
                <Check className="h-4 w-4" />
                {t("passwordUpdated")}
              </div>
            )}

            <Button type="submit" disabled={loading} className="shadow-sm hover:shadow-md transition-all">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin rtl:ml-2 rtl:mr-0" />}
              {t("updatePassword")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
