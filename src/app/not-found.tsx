import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-background via-accent/30 to-background p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl bg-card/80 backdrop-blur-sm">
        <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FileQuestion className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">404</h1>
            <p className="text-muted-foreground">
              The page you&apos;re looking for doesn&apos;t exist.
            </p>
          </div>
          <Button asChild className="gap-2">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
