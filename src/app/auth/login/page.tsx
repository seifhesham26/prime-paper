"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { signIn } from "@/lib/auth-client";
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
import { ScrollText, Loader2, UserPlus } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn.email({
        email,
        password,
      });
      if (result.error) {
        setError(t("error"));
      } else {
        window.location.href = "/";
      }
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-background via-accent/30 to-background p-4">
      <Card className="w-full max-w-md shadow-2xl border-0 bg-card/80 backdrop-blur-sm">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <ScrollText className="h-8 w-8" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">
              Prime Paper | برايم بيبر
            </CardTitle>
            <CardDescription className="mt-1">
              Paper Factory Management System
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
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
            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                dir="ltr"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive text-center bg-destructive/10 rounded-md py-2">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {t("submit")}
                  <UserPlus className="h-4 w-4" />
                </>
              )}
            </Button>
            <div className="text-center pt-2">
               <p className="text-sm text-muted-foreground">
                  {t("dontHaveAccount")}{" "}
                  <Link href="/auth/signup" className="text-primary font-medium hover:underline">
                    {t("signup")}
                  </Link>
               </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
