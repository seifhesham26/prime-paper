"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { api } from "@/trpc/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Truck, Eye, X, Loader2 } from "lucide-react";

type Product = {
  id: string;
  lengthM: string;
  widthCm: string;
  weightKg: string;
};

function PaymentBadge({ status }: { status: "paid" | "partial" | "unpaid" | null }) {
  const t = useTranslations("deliveries");
  const fallbackStatus = status || "unpaid";
  
  const variants: Record<string, "default" | "secondary" | "destructive"> = {
    paid: "default",
    partial: "secondary",
    unpaid: "destructive",
  };
  return (
    <Badge variant={variants[fallbackStatus]} className="capitalize">
      {t(fallbackStatus)}
    </Badge>
  );
}

export function DeliveriesClient({ products }: { products: Product[] }) {
  const t = useTranslations("deliveries");
  const [open, setOpen] = useState(false);

  const utils = api.useUtils();
  
  // Real-time data fetching
  const { data: deliveriesData, isLoading: isLoadingDeliveries } = api.deliveries.getAll.useQuery({ page: 1, limit: 100 });
  const { data: companiesData } = api.companies.getAll.useQuery({ page: 1, limit: 1000 });
  
  const createMutation = api.deliveries.create.useMutation({
    onSuccess: () => {
      utils.deliveries.getAll.invalidate();
      setOpen(false);
      resetForm();
    },
  });

  const deleteMutation = api.deliveries.delete.useMutation({
    onSuccess: () => {
      utils.deliveries.getAll.invalidate();
      utils.analytics.getDashboardStats.invalidate();
    },
  });

  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"paid" | "partial" | "unpaid">("unpaid");
  const [items, setItems] = useState<{ productId: string; quantity: number }[]>([]);

  const resetForm = () => {
    setSelectedCompany("");
    setSelectedStatus("unpaid");
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
      paymentStatus: selectedStatus,
      notes: formData.get("notes") as string || undefined,
      items: items.filter((i) => i.productId),
    });
  };

  const handleDelete = (id: string) => {
    if (confirm(t("confirmDelete"))) {
      deleteMutation.mutate({ id });
    }
  };

  const isSubmitting = createMutation.isPending;
  const deliveries = deliveriesData?.data || [];
  const companies = companiesData?.data || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-semibold tracking-tight">{t("title")}</h3>
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
                    defaultValue={new Date().toISOString().split("T")[0]}
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
              
              <div className="grid grid-cols-2 gap-4">
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
                <div className="space-y-2">
                  <Label className="text-muted-foreground">{t("paymentStatus")}</Label>
                  <Select
                    value={selectedStatus}
                    onValueChange={(v) => setSelectedStatus(v as "paid" | "partial" | "unpaid")}
                  >
                    <SelectTrigger className="bg-muted/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">{t("paid")}</SelectItem>
                      <SelectItem value="partial">{t("partial")}</SelectItem>
                      <SelectItem value="unpaid">{t("unpaid")}</SelectItem>
                    </SelectContent>
                  </Select>
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
                      No products added to this delivery yet.
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
      </div>

      {isLoadingDeliveries ? (
        <Card className="border-0 shadow-md">
           <CardContent className="h-[400px] flex items-center justify-center">
             <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
           </CardContent>
        </Card>
      ) : deliveries.length === 0 ? (
        <Card className="shadow-md bg-muted/30 border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-6">
              <Truck className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <p className="text-lg font-medium">{t("noData")}</p>
            <p className="text-sm text-muted-foreground mt-2">Create your first delivery to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-md overflow-hidden dark:bg-card/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">{t("date")}</TableHead>
                  <TableHead className="font-semibold">{t("company")}</TableHead>
                  <TableHead className="text-center font-semibold">{t("sellingPrice")}</TableHead>
                  <TableHead className="text-center font-semibold">{t("paymentStatus")}</TableHead>
                  <TableHead className="font-semibold">{t("notes")}</TableHead>
                  <TableHead className="text-center w-[120px] font-semibold">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((d) => (
                  <TableRow key={d.id} className="group hover:bg-muted/30 transition-colors">
                    <TableCell dir="ltr" className="text-start whitespace-nowrap">
                      {new Date(d.date).toLocaleDateString("ar-EG", { year: 'numeric', month: 'short', day: 'numeric' })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {d.companyName}
                    </TableCell>
                    <TableCell className="text-center font-medium" dir="ltr">
                      {Number(d.sellingPriceEgp).toLocaleString()} EGP
                    </TableCell>
                    <TableCell className="text-center">
                      <PaymentBadge status={d.paymentStatus} />
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {d.notes || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" asChild className="hover:bg-primary/10 hover:text-primary transition-colors h-8 w-8">
                          <Link href={`/deliveries/${d.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:bg-destructive/10 hover:text-destructive transition-colors h-8 w-8"
                          onClick={() => handleDelete(d.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
