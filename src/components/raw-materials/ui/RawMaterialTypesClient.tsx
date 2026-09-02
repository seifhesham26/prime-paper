"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { Plus, Package, Loader2 } from "lucide-react";
import { parseListParams } from "@/components/ui/data-table/list-params";
import { DataTable } from "@/components/ui/data-table/data-table";
import type { Column } from "@/components/ui/data-table/types";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState } from "@/components/ui/empty-state";
import { RowActions } from "@/components/ui/row-actions";
import { Money, Measure } from "@/components/ui/money";
import { RAW_MATERIAL_SORT_KEYS, type RawMaterialSortKey } from "@/server/raw-materials/types";

type TypeRow = {
  id: string;
  name: string;
  notes: string | null;
  receivedTons: string;
  consumedTons: string;
  balanceTons: string;
  avgCostPerTon: string | null;
};

export function RawMaterialTypesClient() {
  const t = useTranslations("rawMaterials");
  const tc = useTranslations("common");
  const { canWrite } = useUserRole();
  const confirm = useConfirm();

  const searchParams = useSearchParams();
  const { page, search, sortBy, sortDir } = parseListParams(
    searchParams,
    RAW_MATERIAL_SORT_KEYS,
  );

  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<TypeRow | null>(null);

  const utils = api.useUtils();
  const { data, isLoading } = api.rawMaterials.getAll.useQuery({
    page,
    search: search || undefined,
    sortBy: (sortBy ?? undefined) as RawMaterialSortKey | undefined,
    sortDir,
  });

  const invalidate = () => {
    utils.rawMaterials.getAll.invalidate();
    utils.analytics.getDashboardStats.invalidate();
    utils.analytics.evaluateCards.invalidate();
  };

  const createMutation = api.rawMaterials.create.useMutation({
    onSuccess: () => {
      toast.success(tc("saved"));
      invalidate();
      setOpen(false);
      setEditItem(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = api.rawMaterials.update.useMutation({
    onSuccess: () => {
      toast.success(tc("saved"));
      invalidate();
      setOpen(false);
      setEditItem(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = api.rawMaterials.delete.useMutation({
    onSuccess: () => {
      toast.success(tc("deleted"));
      invalidate();
    },
    // Surfaces the server-side guard: a material with history cannot go.
    onError: (err) => toast.error(err.message),
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get("name") as string,
      notes: (formData.get("notes") as string) || undefined,
    };

    if (editItem) {
      updateMutation.mutate({ id: editItem.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = async (row: TypeRow) => {
    const ok = await confirm({
      title: t("confirmDelete"),
      description: `${row.name} — ${tc("confirmDeleteDescription")}`,
      confirmLabel: tc("delete"),
      destructive: true,
    });
    if (ok) deleteMutation.mutate({ id: row.id });
  };

  const types = data?.data ?? [];

  const columns: Column<TypeRow>[] = [
    {
      id: "name",
      header: t("materialName"),
      sortKey: "name",
      cell: (row) => (
        <Link
          href={`/raw-materials/${row.id}`}
          className="font-medium hover:text-primary"
        >
          {row.name}
        </Link>
      ),
    },
    {
      id: "received",
      header: t("received"),
      align: "center",
      sortKey: "receivedTons",
      cell: (row) => <Measure value={row.receivedTons} unit="tons" />,
    },
    {
      id: "consumed",
      header: t("consumed"),
      align: "center",
      sortKey: "consumedTons",
      cell: (row) => (
        <Measure value={row.consumedTons} unit="tons" className="text-muted-foreground" />
      ),
    },
    {
      id: "balance",
      header: t("balance"),
      align: "center",
      sortKey: "balanceTons",
      cell: (row) => (
        <Measure
          value={row.balanceTons}
          unit="tons"
          className={
            Number(row.balanceTons) > 0
              ? "font-semibold text-status-paid"
              : "font-semibold text-muted-foreground"
          }
        />
      ),
    },
    {
      id: "avgCost",
      header: t("avgCostPerTon"),
      align: "center",
      hideOnMobile: true,
      cell: (row) =>
        row.avgCostPerTon ? <Money value={row.avgCostPerTon} /> : "—",
    },
    {
      id: "actions",
      header: t("actions"),
      align: "center",
      cell: (row) => (
        <RowActions
          // The view link is available to every role; only writers get the
          // edit and delete controls.
          viewHref={`/raw-materials/${row.id}`}
          onEdit={
            canWrite
              ? () => {
                  setEditItem(row);
                  setOpen(true);
                }
              : undefined
          }
          onDelete={canWrite ? () => handleDelete(row) : undefined}
          deleteDisabled={deleteMutation.isPending}
        />
      ),
    },
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
                  {t("addType")}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md border-0 shadow-2xl bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
                <DialogHeader>
                  <DialogTitle className="text-xl">
                    {editItem ? t("editType") : t("addType")}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-5 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-muted-foreground">
                      {t("materialName")}
                    </Label>
                    <Input
                      id="name"
                      name="name"
                      defaultValue={editItem?.name ?? ""}
                      placeholder={t("materialNamePlaceholder")}
                      required
                      className="bg-muted/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-muted-foreground">
                      {t("notes")}
                    </Label>
                    <Textarea
                      id="notes"
                      name="notes"
                      defaultValue={editItem?.notes ?? ""}
                      className="bg-muted/50 min-h-[80px]"
                    />
                  </div>
                  <div className="flex gap-3 justify-end pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setOpen(false)}
                      className="hover:bg-muted/50"
                    >
                      {t("cancel")}
                    </Button>
                    <Button type="submit" disabled={isSubmitting} className="min-w-[100px]">
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
        rows={types}
        isLoading={isLoading}
        getRowKey={(row) => row.id}
        emptyState={
          <EmptyState
            icon={Package}
            title={search ? tc("noResults") : t("noTypes")}
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
