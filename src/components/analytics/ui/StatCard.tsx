import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ElementType } from "react";

export function StatCard({
  title,
  value,
  unit,
  icon: Icon,
  gradient,
}: {
  title: string;
  value: number;
  unit: string;
  icon: ElementType;
  gradient: string;
}) {
  return (
    <Card className="group overflow-hidden border-0 shadow-md hover:-translate-y-1 transition-all duration-300 hover:shadow-lg dark:bg-card/50">
      <div className={`h-1 w-full ${gradient}`} />
      <CardHeader className="flex flex-row items-center gap-3 pb-2">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${gradient} text-white shadow-sm`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">
          {value.toLocaleString()}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            {unit}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
