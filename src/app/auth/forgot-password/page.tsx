"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ScrollText, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const requestResetMutation = api.users.requestReset.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setLoading(false);
    },
    onError: (err: { message: string }) => {
      setError(err.message || t("error"));
      setLoading(false);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    requestResetMutation.mutate({ email });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-linear-to-br from-background via-accent/30 to-background p-4 animate-in fade-in duration-500">
      <div className="absolute end-4 top-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <ScrollText className="h-8 w-8" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">
              {t("forgotPasswordTitle")}
            </CardTitle>
            <CardDescription className="mt-1">
              {t("forgotPasswordDesc")}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@primepaper.com"
                  required
                  dir="ltr"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive text-center bg-destructive/10 rounded-md py-2">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t("sendResetLink")
                )}
              </Button>
              <div className="text-center pt-2">
                <Link href="/auth/login" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
                  <ArrowLeft className="h-3 w-3 rtl:rotate-180" />
                  {t("login") || "Back to login"}
                </Link>
              </div>
            </form>
          ) : (
            <div className="text-center space-y-6 py-4">
              <div className="flex justify-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              </div>
              <div className="space-y-2">
                <p className="text-md font-medium text-emerald-600 dark:text-emerald-400">
                  {t("checkEmail")}
                </p>
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link href="/auth/login">{t("login")}</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
