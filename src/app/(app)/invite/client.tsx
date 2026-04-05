"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Loader2, Check, ShieldCheck, Eye } from "lucide-react";

export function InviteClient() {
  const t = useTranslations("invite");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("viewer");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      await authClient.admin.createUser({
        email,
        name,
        password,
        role: role as "user" | "admin",
      });
      setSuccess(true);
      setName("");
      setEmail("");
      setPassword("");
      setRole("viewer");
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg animate-in fade-in duration-500">
      <Card className="border-0 shadow-md bg-card/50">
        <CardHeader className="bg-muted/30 border-b border-muted">
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="h-5 w-5 text-muted-foreground" />
            {t("title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-muted-foreground">{t("name")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-muted/50 focus-visible:ring-primary/50 transition-shadow"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-muted-foreground">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                dir="ltr"
                className="bg-muted/50 focus-visible:ring-primary/50 transition-shadow"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-muted-foreground">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                dir="ltr"
                minLength={8}
                className="bg-muted/50 focus-visible:ring-primary/50 transition-shadow"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">{t("role")}</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="bg-muted/50 focus-visible:ring-primary/50 transition-shadow">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      {t("admin")}
                    </div>
                  </SelectItem>
                  <SelectItem value="viewer">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-blue-600" />
                      {t("viewer")}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-2">
              {error && (
                <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg py-3 px-4 flex items-center gap-2 shadow-sm animate-in zoom-in-95">
                  {error}
                </div>
              )}
              {success && (
                <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg py-3 px-4 flex items-center gap-2 shadow-sm animate-in zoom-in-95 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400">
                  <Check className="h-4 w-4" />
                  {t("success")}
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full gap-2 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {t("submit")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
