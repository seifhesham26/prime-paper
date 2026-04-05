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
import { Plus, Pencil, Trash2, Building2, Loader2 } from "lucide-react";

import type { Company } from "@/server/companies/types";

export function CompaniesClient() {
  const t = useTranslations("companies");
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<Company | null>(null);

  const utils = api.useUtils();
  
  // We use useQuery for initial load but want to keep it simple without infinite scrolling for this refactor demo
  // A production app would likely integrate `useInfiniteQuery` with tRPC if needed
  const { data, isLoading } = api.companies.getAll.useQuery({ page: 1, limit: 100 });
  
  const createMutation = api.companies.create.useMutation({
    onSuccess: () => {
      utils.companies.getAll.invalidate();
      setOpen(false);
      setEditItem(null);
    },
  });

  const updateMutation = api.companies.update.useMutation({
    onSuccess: () => {
      utils.companies.getAll.invalidate();
      setOpen(false);
      setEditItem(null);
    },
  });

  const deleteMutation = api.companies.delete.useMutation({
    onSuccess: () => {
      utils.companies.getAll.invalidate();
    },
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

  const handleDelete = (id: string) => {
    if (confirm(t("confirmDelete"))) {
      deleteMutation.mutate({ id });
    }
  };

  const handleEdit = (item: Company) => {
    setEditItem(item);
    setOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-semibold tracking-tight">{t("title")}</h3>
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
      </div>

      {isLoading ? (
        <Card className="border-0 shadow-md">
           <CardContent className="h-[400px] flex items-center justify-center">
             <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
           </CardContent>
        </Card>
      ) : !data || data.data.length === 0 ? (
        <Card className="shadow-md bg-muted/30 border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-6">
               <Building2 className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <p className="text-lg font-medium">{t("noData")}</p>
            <p className="text-sm text-muted-foreground mt-2">Add your first company to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-md overflow-hidden dark:bg-card/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold">{t("name")}</TableHead>
                  <TableHead className="font-semibold">{t("contactPerson")}</TableHead>
                  <TableHead className="font-semibold">{t("phone")}</TableHead>
                  <TableHead className="font-semibold">{t("address")}</TableHead>
                  <TableHead className="font-semibold">{t("notes")}</TableHead>
                  <TableHead className="text-center font-semibold w-[100px]">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((c) => (
                  <TableRow key={c.id} className="group hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.contactPerson || "-"}</TableCell>
                    <TableCell dir="ltr" className="text-start text-muted-foreground">
                      {c.phone || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.address || "-"}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {c.notes || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(c)}
                          className="hover:bg-primary/10 hover:text-primary transition-colors h-8 w-8"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:bg-destructive/10 hover:text-destructive transition-colors h-8 w-8"
                          onClick={() => handleDelete(c.id)}
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
