import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileQuestion } from "lucide-react";

export default async function NotFound() {
  const t = await getTranslations("errors");

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-background via-accent/30 to-background p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FileQuestion className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">404</h1>
            <p className="font-medium">{t("notFoundTitle")}</p>
            <p className="text-muted-foreground">{t("notFoundDescription")}</p>
          </div>
          <Button asChild className="gap-2">
            <Link href="/dashboard">{t("goToDashboard")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
