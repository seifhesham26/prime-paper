"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Factory, Loader2 } from "lucide-react";
import { parseListParams } from "@/components/ui/data-table/list-params";
import { DataTable } from "@/components/ui/data-table/data-table";
import type { Column } from "@/components/ui/data-table/types";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState } from "@/components/ui/empty-state";
import { RowActions } from "@/components/ui/row-actions";
import { Measure } from "@/components/ui/money";
import { localeTag, toDateInputValue } from "@/lib/format";

import type { Product } from "@/server/products/types";
import { PRODUCT_SORT_KEYS, type ProductSortKey } from "@/server/products/types";

export function ProductsClient() {
  const t = useTranslations("products");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { canWrite } = useUserRole();
  const confirm = useConfirm();

  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<Product | null>(null);
  const [selectedMaterialType, setSelectedMaterialType] = useState<string>("");

  const utils = api.useUtils();

  const searchParams = useSearchParams();
  const { page, search, sortBy, sortDir } = parseListParams(
    searchParams,
    PRODUCT_SORT_KEYS,
  );

  const { data: productsData, isLoading } = api.products.getAll.useQuery({
    page,
    search: search || undefined,
    sortBy: (sortBy ?? undefined) as ProductSortKey | undefined,
    sortDir,
  });
  // Fetched live so a material added moments ago is selectable without a reload.
  const { data: typesData } = api.rawMaterials.getAll.useQuery({ page: 1, forDropdown: true });
  const materialTypes = typesData?.data ?? [];
  
  const createMutation = api.products.create.useMutation({
    onSuccess: () => {
      toast.success(tc("saved"));
      utils.products.getAll.invalidate();
      setOpen(false);
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = api.products.update.useMutation({
    onSuccess: () => {
      toast.success(tc("saved"));
      utils.products.getAll.invalidate();
      setOpen(false);
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = api.products.delete.useMutation({
    onSuccess: () => {
      toast.success(tc("deleted"));
      utils.products.getAll.invalidate();
      utils.analytics.getDashboardStats.invalidate();
      utils.analytics.evaluateCards.invalidate();
    },
    // Surfaces the "appears in a delivery" guard.
    onError: (err) => toast.error(err.message),
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const resetForm = () => {
    setEditItem(null);
    setSelectedMaterialType("");
  };

  const handleEdit = (item: Product) => {
    setEditItem(item);
    setSelectedMaterialType(item.rawMaterialTypeId || "");
    setOpen(true);
  };

  const handleDelete = async (p: Product) => {
    const ok = await confirm({
      title: t("confirmDelete"),
      description: `${p.lengthM}m × ${p.widthCm}cm — ${tc("confirmDeleteDescription")}`,
      confirmLabel: tc("delete"),
      destructive: true,
    });
    if (ok) deleteMutation.mutate({ id: p.id });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const dateStr = formData.get("dateProduced") as string;

    const payload = {
      rawMaterialTypeId: selectedMaterialType || undefined,
      dateProduced: new Date(dateStr),
      lengthM: formData.get("lengthM") as string,
      widthCm: formData.get("widthCm") as string,
      weightKg: formData.get("weightKg") as string,
      quantity: parseInt(formData.get("quantity") as string),
      notes: formData.get("notes") as string || undefined,
    };

    if (editItem) {
      updateMutation.mutate({ id: editItem.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const products = productsData?.data || [];

  const columns: Column<(typeof products)[number]>[] = [
    {
      id: "dateProduced",
      header: t("dateProduced"),
      sortKey: "dateProduced",
      cell: (p) => (
        <span dir="ltr" className="whitespace-nowrap">
          {new Date(p.dateProduced).toLocaleDateString(localeTag(locale), {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </span>
      ),
    },
    {
      id: "material",
      header: t("rawMaterial"),
      cell: (p) => <span className="text-muted-foreground">{p.materialName || "—"}</span>,
    },
    {
      id: "lengthM",
      header: t("lengthM"),
      align: "center",
      sortKey: "lengthM",
      cell: (p) => <span dir="ltr" className="font-medium tabular-nums">{p.lengthM}</span>,
    },
    {
      id: "widthCm",
      header: t("widthCm"),
      align: "center",
      sortKey: "widthCm",
      cell: (p) => <span dir="ltr" className="font-medium tabular-nums">{p.widthCm}</span>,
    },
    {
      id: "weightKg",
      header: t("weightKg"),
      align: "center",
      sortKey: "weightKg",
      cell: (p) => <Measure value={p.weightKg} unit="kg" className="text-muted-foreground" />,
    },
    {
      id: "quantity",
      header: t("quantity"),
      align: "center",
      sortKey: "quantity",
      cell: (p) => <span dir="ltr" className="font-medium tabular-nums">{p.quantity}</span>,
    },
    ...(canWrite
      ? [
          {
            id: "actions",
            header: t("actions"),
            align: "center" as const,
            cell: (p: (typeof products)[number]) => (
              <RowActions
                onEdit={() => handleEdit(p)}
                onDelete={() => handleDelete(p)}
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
                if (!v) resetForm();
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
                  <DialogTitle className="text-xl">{editItem ? t("edit") : t("addNew")}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-5 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="dateProduced" className="text-muted-foreground">{t("dateProduced")}</Label>
                    <Input
                      id="dateProduced"
                      name="dateProduced"
                      type="date"
                      defaultValue={
                        editItem
                          ? toDateInputValue(new Date(editItem.dateProduced))
                          : toDateInputValue(new Date())
                      }
                      required
                      dir="ltr"
                      className="bg-muted/50 focus-visible:ring-primary/50 transition-shadow"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t("rawMaterial")}</Label>
                    <Select
                      value={selectedMaterialType}
                      onValueChange={setSelectedMaterialType}
                    >
                      <SelectTrigger className="bg-muted/50 focus-visible:ring-primary/50 transition-shadow">
                        <SelectValue placeholder={t("selectRawMaterial")} />
                      </SelectTrigger>
                      <SelectContent>
                        {materialTypes.map((rm) => (
                          <SelectItem key={rm.id} value={rm.id}>
                            {rm.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="lengthM" className="text-muted-foreground">{t("lengthM")}</Label>
                      <Input
                        id="lengthM"
                        name="lengthM"
                        type="number"
                        step="0.01"
                        defaultValue={editItem?.lengthM || ""}
                        required
                        dir="ltr"
                        className="bg-muted/50 focus-visible:ring-primary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="widthCm" className="text-muted-foreground">{t("widthCm")}</Label>
                      <Input
                        id="widthCm"
                        name="widthCm"
                        type="number"
                        step="0.01"
                        defaultValue={editItem?.widthCm || ""}
                        required
                        dir="ltr"
                        className="bg-muted/50 focus-visible:ring-primary/50"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="weightKg" className="text-muted-foreground">{t("weightKg")}</Label>
                      <Input
                        id="weightKg"
                        name="weightKg"
                        type="number"
                        step="0.01"
                        defaultValue={editItem?.weightKg || ""}
                        required
                        dir="ltr"
                        className="bg-muted/50 focus-visible:ring-primary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quantity" className="text-muted-foreground">{t("quantity")}</Label>
                      <Input
                        id="quantity"
                        name="quantity"
                        type="number"
                        min="1"
                        defaultValue={editItem?.quantity || 1}
                        required
                        dir="ltr"
                        className="bg-muted/50 focus-visible:ring-primary/50"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-muted-foreground">{t("notes")}</Label>
                    <Textarea
                      id="notes"
                      name="notes"
                      defaultValue={editItem?.notes || ""}
                      className="bg-muted/50 focus-visible:ring-primary/50 min-h-[80px]"
                    />
                  </div>
                  <div className="flex gap-3 justify-end pt-4">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setOpen(false);
                        resetForm();
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
        rows={products}
        isLoading={isLoading}
        getRowKey={(p) => p.id}
        emptyState={
          <EmptyState
            icon={Factory}
            title={search ? tc("noResults") : t("noData")}
            description={search ? undefined : t("emptyStateDesc")}
          />
        }
        pagination={
          productsData
            ? {
                currentPage: page,
                totalPages: productsData.totalPages,
                totalItems: productsData.total,
              }
            : undefined
        }
      />
    </div>
  );
}
