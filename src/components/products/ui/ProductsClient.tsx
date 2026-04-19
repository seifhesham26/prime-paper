"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { api } from "@/trpc/react";
import { useUserRole } from "@/hooks/use-role";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Factory, Loader2 } from "lucide-react";

import type { Product } from "@/server/products/types";

type RawMaterial = {
  id: string;
  supplierName: string;
  dateReceived: string;
  weightTons: string;
};

export function ProductsClient({
  rawMaterials,
}: {
  rawMaterials: RawMaterial[];
}) {
  const t = useTranslations("products");
  const locale = useLocale();
  const isArabic = locale === "ar";
  const { canWrite } = useUserRole();
  
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<Product | null>(null);
  const [selectedRawMaterial, setSelectedRawMaterial] = useState<string>("");

  const utils = api.useUtils();
  
  const { data: productsData, isLoading } = api.products.getAll.useQuery({ page: 1, limit: 100 });
  
  const createMutation = api.products.create.useMutation({
    onSuccess: () => {
      utils.products.getAll.invalidate();
      setOpen(false);
      resetForm();
    },
  });

  const updateMutation = api.products.update.useMutation({
    onSuccess: () => {
      utils.products.getAll.invalidate();
      setOpen(false);
      resetForm();
    },
  });

  const deleteMutation = api.products.delete.useMutation({
    onSuccess: () => {
      utils.products.getAll.invalidate();
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const resetForm = () => {
    setEditItem(null);
    setSelectedRawMaterial("");
  };

  const handleEdit = (item: Product) => {
    setEditItem(item);
    setSelectedRawMaterial(item.rawMaterialId || "");
    setOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm(t("confirmDelete"))) {
      deleteMutation.mutate({ id });
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const dateStr = formData.get("dateProduced") as string;

    const payload = {
      rawMaterialId: selectedRawMaterial || undefined,
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-semibold tracking-tight">{t("title")}</h3>
        {canWrite && <Dialog
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
                      ? new Date(editItem.dateProduced).toISOString().split("T")[0]
                      : new Date().toISOString().split("T")[0]
                  }
                  required
                  dir="ltr"
                  className="bg-muted/50 focus-visible:ring-primary/50 transition-shadow"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">{t("rawMaterial")}</Label>
                <Select
                  value={selectedRawMaterial}
                  onValueChange={setSelectedRawMaterial}
                >
                  <SelectTrigger className="bg-muted/50 focus-visible:ring-primary/50 transition-shadow">
                    <SelectValue placeholder={t("selectRawMaterial")} />
                  </SelectTrigger>
                  <SelectContent>
                    {rawMaterials.map((rm) => (
                      <SelectItem key={rm.id} value={rm.id}>
                        {rm.supplierName} - {new Date(rm.dateReceived).toLocaleDateString(isArabic ? "ar-EG" : "en-US")} ({rm.weightTons} {isArabic ? "طن" : "tons"})
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
        </Dialog>}
      </div>

      {isLoading ? (
        <Card className="border-0 shadow-md">
           <CardContent className="h-[400px] flex items-center justify-center">
             <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
           </CardContent>
        </Card>
      ) : products.length === 0 ? (
        <Card className="shadow-md bg-muted/30 border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-6">
               <Factory className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <p className="text-lg font-medium">{t("noData")}</p>
            <p className="text-sm text-muted-foreground mt-2">{t("emptyStateDesc")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-md overflow-hidden dark:bg-card/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">{t("dateProduced")}</TableHead>
                  <TableHead className="font-semibold">{t("rawMaterial")}</TableHead>
                  <TableHead className="text-center font-semibold">{t("lengthM")}</TableHead>
                  <TableHead className="text-center font-semibold">{t("widthCm")}</TableHead>
                  <TableHead className="text-center font-semibold">{t("weightKg")}</TableHead>
                  <TableHead className="text-center font-semibold">{t("quantity")}</TableHead>
                  {canWrite && <TableHead className="text-center font-semibold w-[100px]">{t("actions")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id} className="group hover:bg-muted/30 transition-colors">
                    <TableCell dir="ltr" className="text-start whitespace-nowrap">
                      {new Date(p.dateProduced).toLocaleDateString(isArabic ? "ar-EG" : "en-US", { year: 'numeric', month: 'short', day: 'numeric' })}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.supplierName || "-"}</TableCell>
                    <TableCell className="text-center font-medium" dir="ltr">
                      {p.lengthM}
                    </TableCell>
                    <TableCell className="text-center font-medium" dir="ltr">
                      {p.widthCm}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground" dir="ltr">
                      {p.weightKg} {isArabic ? "كجم" : "kg"}
                    </TableCell>
                    <TableCell className="text-center font-medium" dir="ltr">
                      {p.quantity}
                    </TableCell>
                    {canWrite && <TableCell>
                      <div className="flex items-center justify-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(p)}
                          className="hover:bg-primary/10 hover:text-primary transition-colors h-8 w-8"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:bg-destructive/10 hover:text-destructive transition-colors h-8 w-8"
                          onClick={() => handleDelete(p.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>}
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
