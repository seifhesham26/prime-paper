"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/trpc/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Loader2, Check, ShieldCheck, Eye, KeyRound } from "lucide-react";

export function InviteClient() {
  const t = useTranslations("invite");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Goes through the server so the role is applied by code that has already
  // authorised the caller. The previous client-side admin call returned
  // { error } rather than throwing, so failures were reported as successes.
  const inviteMutation = api.users.invite.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setError("");
      setName("");
      setEmail("");
      setPassword("");
      setRole("user");
    },
    onError: (err) => {
      setSuccess(false);
      setError(err.message || t("error"));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    inviteMutation.mutate({
      name,
      email,
      password,
      role: role as "admin" | "user",
    });
  };

  return (
    <div className="max-w-lg w-full mx-auto animate-in fade-in duration-500">
      <Tabs defaultValue="create" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="create">{t("createUser")}</TabsTrigger>
          <TabsTrigger value="resets">{t("passwordResets")}</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          <Card className="border-0 shadow-xl bg-background/60 backdrop-blur-sm">
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
                          {t("roleAdmin")}
                        </div>
                      </SelectItem>
                      <SelectItem value="user">
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4 text-blue-600" />
                          {t("roleViewer")}
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

                  <Button type="submit" disabled={inviteMutation.isPending} className="w-full gap-2 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                    {inviteMutation.isPending ? (
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
        </TabsContent>

        <TabsContent value="resets" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          <PasswordResetsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PasswordResetsTab() {
  const t = useTranslations("invite");
  const { data: requests, isLoading } = api.users.getPendingResets.useQuery();
  const utils = api.useUtils();
  const resolveMutation = api.users.resolveReset.useMutation({
    onSuccess: () => utils.users.getPendingResets.invalidate()
  });

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [passwords, setPasswords] = useState<Record<string, string>>({});

  const handleResolve = async (id: string, email: string) => {
    const newPassword = passwords[id];
    if (!newPassword || newPassword.length < 8) return alert(t("passwordMinLength"));
    setLoadingId(id);
    
    try {
      // Look up user by email via targeted server-side query
      const found = await utils.users.getUserIdByEmail.fetch({ email });

      if (!found) {
        // Resolving here would close the ticket without changing any password.
        alert(t("resetFailed") + ": " + t("noAccountForEmail"));
        return;
      }

      // Better Auth returns { error } rather than throwing, so this must be
      // checked explicitly — otherwise a failed reset still marks the ticket
      // resolved and the person is told it worked.
      const res = await authClient.admin.updateUser({
        userId: found.id,
        data: { password: newPassword },
      });

      if (res.error) {
        alert(t("resetFailed") + ": " + (res.error.message ?? ""));
        return;
      }

      resolveMutation.mutate({ id });
    } catch (err) {
      console.error(err);
      alert(t("resetFailed") + ": " + (err instanceof Error ? err.message : ""));
    } finally {
      setLoadingId(null);
    }
  };

  if (isLoading) return <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>;
  if (!requests?.length) {
    return (
      <Card className="border-dashed shadow-none bg-transparent">
        <CardContent className="flex flex-col items-center justify-center p-12 text-muted-foreground">
           <KeyRound className="h-8 w-8 mb-4 opacity-50" />
           <p>{t("noPendingResets")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((req) => (
        <Card key={req.id} className="bg-card w-full shadow-sm border border-border/50 animate-in slide-in-from-bottom-2">
          <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div>
              <p className="font-medium text-sm">{req.email}</p>
              <p className="text-xs text-muted-foreground">Requested on: {new Date(req.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
              <Input 
                type="password" 
                placeholder={t("newPassword")} 
                value={passwords[req.id] || ""}
                onChange={(e) => setPasswords({...passwords, [req.id]: e.target.value})}
                className="w-full sm:w-[150px] h-9 text-sm focus-visible:ring-primary/50"
              />
              <Button size="sm" onClick={() => handleResolve(req.id, req.email)} disabled={loadingId === req.id || !passwords[req.id] || passwords[req.id].length < 8}>
                {loadingId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : t("resolve")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
