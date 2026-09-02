import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
  search,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  search?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {search}
        {action}
      </div>
    </div>
  );
}
