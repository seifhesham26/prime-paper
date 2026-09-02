"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { signUp } from "@/lib/auth-client";
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
import { ScrollText, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export function SignupClient() {
  const t = useTranslations("auth");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signUp.email({
        email,
        password,
        name,
        callbackURL: "/dashboard",
      });
      if (result.error) {
        setError(result.error.message || t("signupError"));
      } else {
        // Redirection is handled by callbackURL or manually if needed
        window.location.href = "/dashboard";
      }
    } catch {
      setError(t("signupError"));
    } finally {
      setLoading(false);
    }
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
              {t("signup")}
            </CardTitle>
            <CardDescription className="mt-1">
               {t("brandDesc")}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("name")}</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
              />
            </div>
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
                minLength={8}
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
                  {t("signupSubmit")}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </>
              )}
            </Button>
            <div className="text-center pt-2">
               <p className="text-sm text-muted-foreground">
                  {t("alreadyHaveAccount")}{" "}
                  <Link href="/auth/login" className="text-primary font-medium hover:underline">
                    {t("login")}
                  </Link>
               </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
