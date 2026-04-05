"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/trpc/react";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Package, Loader2 } from "lucide-react";

import type { RawMaterial } from "@/server/raw-materials/types";

export function RawMaterialsClient() {
  const t = useTranslations("rawMaterials");
  
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<RawMaterial | null>(null);

  const utils = api.useUtils();
  
  const { data: materialsData, isLoading } = api.rawMaterials.getAll.useQuery({ page: 1, limit: 100 });
  
  const createMutation = api.rawMaterials.create.useMutation({
    onSuccess: () => {
      utils.rawMaterials.getAll.invalidate();
      setOpen(false);
      resetForm();
    },
  });

  const updateMutation = api.rawMaterials.update.useMutation({
    onSuccess: () => {
      utils.rawMaterials.getAll.invalidate();
      setOpen(false);
      resetForm();
    },
  });

  const deleteMutation = api.rawMaterials.delete.useMutation({
    onSuccess: () => {
      utils.rawMaterials.getAll.invalidate();
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const resetForm = () => {
    setEditItem(null);
  };

  const handleEdit = (item: RawMaterial) => {
    setEditItem(item);
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
    const dateStr = formData.get("dateReceived") as string;

    const payload = {
      dateReceived: new Date(dateStr),
      supplierName: formData.get("supplierName") as string,
      weightTons: formData.get("weightTons") as string,
      costEgp: formData.get("costEgp") as string,
      notes: formData.get("notes") as string || undefined,
    };

    if (editItem) {
      updateMutation.mutate({ id: editItem.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const materials = materialsData?.data || [];

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
          <DialogContent className="sm:max-w-md border-0 shadow-2xl bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
            <DialogHeader>
              <DialogTitle className="text-xl">{editItem ? t("edit") : t("addNew")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5 mt-4">
              <div className="space-y-2">
                <Label htmlFor="dateReceived" className="text-muted-foreground">{t("dateReceived")}</Label>
                <Input
                  id="dateReceived"
                  name="dateReceived"
                  type="date"
                  defaultValue={
                    editItem
                      ? new Date(editItem.dateReceived).toISOString().split("T")[0]
                      : new Date().toISOString().split("T")[0]
                  }
                  required
                  dir="ltr"
                  className="bg-muted/50 focus-visible:ring-primary/50 transition-shadow"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplierName" className="text-muted-foreground">{t("supplierName")}</Label>
                <Input
                  id="supplierName"
                  name="supplierName"
                  defaultValue={editItem?.supplierName || ""}
                  required
                  className="bg-muted/50 focus-visible:ring-primary/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="weightTons" className="text-muted-foreground">{t("weightTons")}</Label>
                  <Input
                    id="weightTons"
                    name="weightTons"
                    type="number"
                    step="0.001"
                    defaultValue={editItem?.weightTons || ""}
                    required
                    dir="ltr"
                    className="bg-muted/50 focus-visible:ring-primary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="costEgp" className="text-muted-foreground">{t("costEgp")}</Label>
                  <Input
                    id="costEgp"
                    name="costEgp"
                    type="number"
                    step="0.01"
                    defaultValue={editItem?.costEgp || ""}
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
      </div>

      {isLoading ? (
        <Card className="border-0 shadow-md">
           <CardContent className="h-[400px] flex items-center justify-center">
             <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
           </CardContent>
        </Card>
      ) : materials.length === 0 ? (
        <Card className="shadow-md bg-muted/30 border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-6">
               <Package className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <p className="text-lg font-medium">{t("noData")}</p>
            <p className="text-sm text-muted-foreground mt-2">Add your first incoming raw material shipment.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-md overflow-hidden dark:bg-card/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">{t("dateReceived")}</TableHead>
                  <TableHead className="font-semibold">{t("supplierName")}</TableHead>
                  <TableHead className="text-center font-semibold">
                    {t("weightTons")}
                  </TableHead>
                  <TableHead className="text-center font-semibold">{t("costEgp")}</TableHead>
                  <TableHead className="text-center font-semibold">
                    {t("costPerTon")}
                  </TableHead>
                  <TableHead className="font-semibold">{t("notes")}</TableHead>
                  <TableHead className="text-center font-semibold w-[100px]">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((m) => (
                  <TableRow key={m.id} className="group hover:bg-muted/30 transition-colors">
                    <TableCell dir="ltr" className="text-start whitespace-nowrap">
                      {new Date(m.dateReceived).toLocaleDateString("ar-EG", { year: 'numeric', month: 'short', day: 'numeric' })}
                    </TableCell>
                    <TableCell className="font-medium text-muted-foreground">{m.supplierName}</TableCell>
                    <TableCell className="text-center font-medium" dir="ltr">
                      {Number(m.weightTons).toLocaleString()} Tons
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground" dir="ltr">
                      {Number(m.costEgp).toLocaleString()} EGP
                    </TableCell>
                    <TableCell className="text-center font-medium text-emerald-600 dark:text-emerald-500" dir="ltr">
                      {m.costPerTon
                        ? `${Number(m.costPerTon).toLocaleString()} EGP`
                        : "-"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {m.notes || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(m)}
                          className="hover:bg-primary/10 hover:text-primary transition-colors h-8 w-8"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:bg-destructive/10 hover:text-destructive transition-colors h-8 w-8"
                          onClick={() => handleDelete(m.id)}
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
