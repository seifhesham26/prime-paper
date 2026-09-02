"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { api } from "@/trpc/react";
import { useUserRole } from "@/hooks/use-role";
import { useConfirm } from "@/components/ui/confirm-dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Building2, Loader2 } from "lucide-react";
import { parseListParams } from "@/components/ui/data-table/list-params";
import { DataTable } from "@/components/ui/data-table/data-table";
import type { Column } from "@/components/ui/data-table/types";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState } from "@/components/ui/empty-state";
import { RowActions } from "@/components/ui/row-actions";

import type { Company } from "@/server/companies/types";
import { COMPANY_SORT_KEYS, type CompanySortKey } from "@/server/companies/types";

export function CompaniesClient() {
  const t = useTranslations("companies");
  const tc = useTranslations("common");
  const { canWrite } = useUserRole();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<Company | null>(null);

  const utils = api.useUtils();

  const searchParams = useSearchParams();
  const { page, search, sortBy, sortDir } = parseListParams(
    searchParams,
    COMPANY_SORT_KEYS,
  );

  const { data, isLoading } = api.companies.getAll.useQuery({
    page,
    search: search || undefined,
    // parseListParams returns `string | null`; the tRPC input expects the key
    // or nothing at all, so null has to become undefined here.
    sortBy: (sortBy ?? undefined) as CompanySortKey | undefined,
    sortDir,
  });

  const createMutation = api.companies.create.useMutation({
    onSuccess: () => {
      toast.success(tc("saved"));
      utils.companies.getAll.invalidate();
      setOpen(false);
      setEditItem(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = api.companies.update.useMutation({
    onSuccess: () => {
      toast.success(tc("saved"));
      utils.companies.getAll.invalidate();
      setOpen(false);
      setEditItem(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = api.companies.delete.useMutation({
    onSuccess: () => {
      toast.success(tc("deleted"));
      utils.companies.getAll.invalidate();
      utils.analytics.getDashboardStats.invalidate();
    },
    // Surfaces the "still has deliveries" guard.
    onError: (err) => toast.error(err.message),
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const payload = {
      name: formData.get("name") as string,
      contactPerson: formData.get("contactPerson") as string || undefined,
      phone: formData.get("phone") as string || undefined,
      address: formData.get("address") as string || undefined,
      notes: formData.get("notes") as string || undefined,
    };

    if (editItem) {
      updateMutation.mutate({ id: editItem.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = async (company: Company) => {
    const ok = await confirm({
      title: t("confirmDelete"),
      description: `${company.name} — ${tc("confirmDeleteDescription")}`,
      confirmLabel: tc("delete"),
      destructive: true,
    });
    if (ok) deleteMutation.mutate({ id: company.id });
  };

  const handleEdit = (item: Company) => {
    setEditItem(item);
    setOpen(true);
  };

  const columns: Column<Company>[] = [
    {
      id: "name",
      header: t("name"),
      sortKey: "name",
      cell: (c) => <span className="font-medium">{c.name}</span>,
    },
    {
      id: "contactPerson",
      header: t("contactPerson"),
      sortKey: "contactPerson",
      cell: (c) => (
        <span className="text-muted-foreground">{c.contactPerson || "—"}</span>
      ),
    },
    {
      id: "phone",
      header: t("phone"),
      cell: (c) => (
        <span dir="ltr" className="text-muted-foreground">
          {c.phone || "—"}
        </span>
      ),
    },
    {
      id: "address",
      header: t("address"),
      hideOnMobile: true,
      cell: (c) => (
        <span className="text-muted-foreground">{c.address || "—"}</span>
      ),
    },
    {
      id: "notes",
      header: t("notes"),
      hideOnMobile: true,
      cell: (c) => (
        <span className="block max-w-[200px] truncate text-muted-foreground">
          {c.notes || "—"}
        </span>
      ),
    },
    ...(canWrite
      ? [
          {
            id: "actions",
            header: t("actions"),
            align: "center" as const,
            cell: (c: Company) => (
              <RowActions
                onEdit={() => handleEdit(c)}
                onDelete={() => handleDelete(c)}
                deleteDisabled={deleteMutation.isPending}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        search={<SearchInput placeholder={t("searchPlaceholder")} />}
        action={
          canWrite ? (
            <Dialog
              open={open}
              onOpenChange={(v) => {
                setOpen(v);
                if (!v) setEditItem(null);
              }}
            >
              <DialogTrigger asChild>
                <Button className="gap-2 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                  <Plus className="h-4 w-4" />
                  {t("addNew")}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md border-0 shadow-2xl bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
                <DialogHeader>
                  <DialogTitle className="text-xl">
                    {editItem ? t("edit") : t("addNew")}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-5 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-muted-foreground">{t("name")}</Label>
                    <Input
                      id="name"
                      name="name"
                      defaultValue={editItem?.name || ""}
                      required
                      className="bg-muted/50 focus-visible:ring-primary/50 transition-shadow"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contactPerson" className="text-muted-foreground">{t("contactPerson")}</Label>
                      <Input
                        id="contactPerson"
                        name="contactPerson"
                        defaultValue={editItem?.contactPerson || ""}
                        className="bg-muted/50 focus-visible:ring-primary/50 transition-shadow"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-muted-foreground">{t("phone")}</Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        defaultValue={editItem?.phone || ""}
                        dir="ltr"
                        className="bg-muted/50 focus-visible:ring-primary/50 transition-shadow"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address" className="text-muted-foreground">{t("address")}</Label>
                    <Input
                      id="address"
                      name="address"
                      defaultValue={editItem?.address || ""}
                      className="bg-muted/50 focus-visible:ring-primary/50 transition-shadow"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-muted-foreground">{t("notes")}</Label>
                    <Textarea
                      id="notes"
                      name="notes"
                      defaultValue={editItem?.notes || ""}
                      className="bg-muted/50 focus-visible:ring-primary/50 transition-shadow min-h-[100px]"
                    />
                  </div>
                  <div className="flex gap-3 justify-end pt-4">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setOpen(false);
                        setEditItem(null);
                      }}
                      className="hover:bg-muted/50"
                    >
                      {t("cancel")}
                    </Button>
                    <Button type="submit" disabled={isSubmitting} className="min-w-[100px] shadow-sm hover:shadow-md transition-all">
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        isLoading={isLoading}
        getRowKey={(c) => c.id}
        emptyState={
          <EmptyState
            icon={Building2}
            title={search ? tc("noResults") : t("noData")}
            description={search ? undefined : t("emptyStateDesc")}
          />
        }
        pagination={
          data
            ? {
                currentPage: page,
                totalPages: data.totalPages,
                totalItems: data.total,
              }
            : undefined
        }
      />
    </div>
  );
}
