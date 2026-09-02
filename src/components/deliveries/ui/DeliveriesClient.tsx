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
import { Plus, Truck, X, Loader2 } from "lucide-react";
import { parseListParams } from "@/components/ui/data-table/list-params";
import { DataTable } from "@/components/ui/data-table/data-table";
import type { Column } from "@/components/ui/data-table/types";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState } from "@/components/ui/empty-state";
import { RowActions } from "@/components/ui/row-actions";
import { Money } from "@/components/ui/money";
import { localeTag, toDateInputValue } from "@/lib/format";
import { DELIVERY_SORT_KEYS, type DeliverySortKey } from "@/server/deliveries/types";
import { PaymentBadge } from "@/components/deliveries/ui/payment-badge";

export function DeliveriesClient() {
  const t = useTranslations("deliveries");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { canWrite } = useUserRole();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);

  const utils = api.useUtils();

  const searchParams = useSearchParams();
  const { page, search, sortBy, sortDir } = parseListParams(
    searchParams,
    DELIVERY_SORT_KEYS,
  );

  const { data: deliveriesData, isLoading: isLoadingDeliveries } =
    api.deliveries.getAll.useQuery({
      page,
      search: search || undefined,
      sortBy: (sortBy ?? undefined) as DeliverySortKey | undefined,
      sortDir,
    });
  const { data: companiesData } = api.companies.getAll.useQuery({ page: 1, forDropdown: true });
  // Fetched live so a product added moments ago is selectable without a reload.
  const { data: productsData } = api.products.getAll.useQuery({ page: 1, forDropdown: true });
  const products = productsData?.data ?? [];
  
  const createMutation = api.deliveries.create.useMutation({
    onSuccess: () => {
      toast.success(tc("saved"));
      utils.deliveries.getAll.invalidate();
      utils.analytics.getDashboardStats.invalidate();
      utils.analytics.evaluateCards.invalidate();
      setOpen(false);
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = api.deliveries.delete.useMutation({
    onSuccess: () => {
      toast.success(tc("deleted"));
      utils.deliveries.getAll.invalidate();
      utils.analytics.getDashboardStats.invalidate();
      utils.analytics.evaluateCards.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const [selectedCompany, setSelectedCompany] = useState("");
  const [items, setItems] = useState<{ productId: string; quantity: number }[]>([]);

  const resetForm = () => {
    setSelectedCompany("");
    setItems([]);
  };

  const addItem = () => {
    setItems([...items, { productId: "", quantity: 1 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: "productId" | "quantity", value: string | number) => {
    const newItems = [...items];
    if (field === "quantity") {
      newItems[index].quantity = value as number;
    } else {
      newItems[index].productId = value as string;
    }
    setItems(newItems);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const dateStr = formData.get("date") as string;
    
    createMutation.mutate({
      date: new Date(dateStr),
      companyId: selectedCompany,
      sellingPriceEgp: formData.get("sellingPriceEgp") as string,
      notes: formData.get("notes") as string || undefined,
      items: items.filter((i) => i.productId),
    });
  };

  const handleDelete = async (d: (typeof deliveries)[number]) => {
    const ok = await confirm({
      title: t("confirmDelete"),
      description: `${d.companyName} — ${tc("confirmDeleteDescription")}`,
      confirmLabel: tc("delete"),
      destructive: true,
    });
    if (ok) deleteMutation.mutate({ id: d.id });
  };

  const isSubmitting = createMutation.isPending;
  const deliveries = deliveriesData?.data || [];
  const companies = companiesData?.data || [];

  const columns: Column<(typeof deliveries)[number]>[] = [
    {
      id: "date",
      header: t("date"),
      sortKey: "date",
      cell: (d) => (
        <span dir="ltr" className="whitespace-nowrap">
          {new Date(d.date).toLocaleDateString(localeTag(locale), {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </span>
      ),
    },
    {
      id: "company",
      header: t("company"),
      sortKey: "companyName",
      cell: (d) => <span className="font-medium">{d.companyName}</span>,
    },
    {
      id: "sellingPrice",
      header: t("sellingPrice"),
      align: "center",
      sortKey: "sellingPriceEgp",
      cell: (d) => <Money value={d.sellingPriceEgp} className="font-medium" />,
    },
    {
      id: "paymentStatus",
      header: t("paymentStatus"),
      align: "center",
      sortKey: "paymentStatus",
      cell: (d) => <PaymentBadge status={d.paymentStatus} />,
    },
    {
      id: "notes",
      header: t("notes"),
      hideOnMobile: true,
      cell: (d) => (
        <span className="block max-w-[200px] truncate text-muted-foreground">
          {d.notes || "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: t("actions"),
      align: "center",
      cell: (d) => (
        <RowActions
          viewHref={`/deliveries/${d.id}`}
          onDelete={canWrite ? () => handleDelete(d) : undefined}
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
                if (!v) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button className="gap-2 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                  <Plus className="h-4 w-4" />
                  {t("addNew")}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto border-0 shadow-2xl bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
                <DialogHeader>
                  <DialogTitle className="text-xl">{t("addNew")}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-5 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="date" className="text-muted-foreground">{t("date")}</Label>
                      <Input
                        id="date"
                        name="date"
                        type="date"
                        defaultValue={toDateInputValue(new Date())}
                        required
                        dir="ltr"
                        className="bg-muted/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">{t("company")}</Label>
                      <Select
                        value={selectedCompany}
                        onValueChange={setSelectedCompany}
                        required
                      >
                        <SelectTrigger className="bg-muted/50">
                          <SelectValue placeholder={t("company")} />
                        </SelectTrigger>
                        <SelectContent>
                          {companies.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sellingPriceEgp" className="text-muted-foreground">{t("sellingPrice")}</Label>
                      <Input
                        id="sellingPriceEgp"
                        name="sellingPriceEgp"
                        type="number"
                        step="0.01"
                        required
                        dir="ltr"
                        className="bg-muted/50"
                      />
                    </div>
                  </div>

                  {/* Delivery Items section */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">{t("items")}</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1 hover:bg-muted/50">
                        <Plus className="h-3 w-3" />
                        {t("addItem")}
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {items.map((item, index) => (
                        <div key={index} className="flex items-end gap-2 rounded-lg border border-muted-foreground/10 bg-muted/20 p-3 transition-colors hover:bg-muted/40">
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs text-muted-foreground">{t("product")}</Label>
                            <Select
                              value={item.productId}
                              onValueChange={(v) => updateItem(index, "productId", v)}
                            >
                              <SelectTrigger className="bg-background">
                                <SelectValue placeholder={t("product")} />
                              </SelectTrigger>
                              <SelectContent>
                                {products.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.lengthM}m × {p.widthCm}cm ({p.weightKg}kg)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="w-24 space-y-1">
                            <Label className="text-xs text-muted-foreground">{t("quantity")}</Label>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                              dir="ltr"
                              className="bg-background"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10 shrink-0 h-10 w-10"
                            onClick={() => removeItem(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {items.length === 0 && (
                        <div className="text-center py-6 text-sm text-muted-foreground border-2 border-dashed rounded-lg border-muted">
                          {t("emptyItems")}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <Label htmlFor="notes" className="text-muted-foreground">{t("notes")}</Label>
                    <Textarea id="notes" name="notes" className="bg-muted/50 min-h-[80px]" />
                  </div>
                  <div className="flex gap-3 justify-end pt-4">
                    <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="hover:bg-muted/50">
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
        rows={deliveries}
        isLoading={isLoadingDeliveries}
        getRowKey={(d) => d.id}
        emptyState={
          <EmptyState
            icon={Truck}
            title={search ? tc("noResults") : t("noData")}
            description={search ? undefined : t("emptyStateDesc")}
          />
        }
        pagination={
          deliveriesData
            ? {
                currentPage: page,
                totalPages: deliveriesData.totalPages,
                totalItems: deliveriesData.total,
              }
            : undefined
        }
      />
    </div>
  );
}
