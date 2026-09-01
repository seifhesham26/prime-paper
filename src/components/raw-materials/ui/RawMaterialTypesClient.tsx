"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Plus, Pencil, Trash2, Package, Loader2, Eye } from "lucide-react";

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
  const { canWrite } = useUserRole();

  // PaginationControls owns writing ?page= back to the URL; we only read it.
  const searchParams = useSearchParams();
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));

  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<TypeRow | null>(null);

  const utils = api.useUtils();
  const { data, isLoading } = api.rawMaterials.getAll.useQuery({ page });

  const invalidate = () => {
    utils.rawMaterials.getAll.invalidate();
    utils.analytics.getDashboardStats.invalidate();
    utils.analytics.evaluateCards.invalidate();
  };

  const createMutation = api.rawMaterials.create.useMutation({
    onSuccess: () => {
      invalidate();
      setOpen(false);
      setEditItem(null);
    },
    onError: (err) => alert(err.message),
  });

  const updateMutation = api.rawMaterials.update.useMutation({
    onSuccess: () => {
      invalidate();
      setOpen(false);
      setEditItem(null);
    },
    onError: (err) => alert(err.message),
  });

  const deleteMutation = api.rawMaterials.delete.useMutation({
    onSuccess: invalidate,
    // Surfaces the server-side guard: a material with history cannot go.
    onError: (err) => alert(err.message),
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

  const handleDelete = (id: string) => {
    if (confirm(t("confirmDelete"))) {
      deleteMutation.mutate({ id });
    }
  };

  const types = data?.data ?? [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-semibold tracking-tight">{t("title")}</h3>
        {canWrite && (
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
        )}
      </div>

      {isLoading ? (
        <Card className="border-0 shadow-md">
          <CardContent className="h-[400px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
          </CardContent>
        </Card>
      ) : types.length === 0 ? (
        <Card className="shadow-md bg-muted/30 border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-6">
              <Package className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <p className="text-lg font-medium">{t("noTypes")}</p>
            <p className="text-sm text-muted-foreground mt-2">{t("emptyStateDesc")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-md overflow-hidden dark:bg-card/50">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold">{t("materialName")}</TableHead>
                    <TableHead className="text-center font-semibold">{t("received")}</TableHead>
                    <TableHead className="text-center font-semibold">{t("consumed")}</TableHead>
                    <TableHead className="text-center font-semibold">{t("balance")}</TableHead>
                    <TableHead className="text-center font-semibold">
                      {t("avgCostPerTon")}
                    </TableHead>
                    <TableHead className="text-center w-[140px] font-semibold">
                      {t("actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {types.map((row) => (
                    <TableRow key={row.id} className="group hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium">
                        <Link
                          href={`/raw-materials/${row.id}`}
                          className="hover:text-primary transition-colors"
                        >
                          {row.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center" dir="ltr">
                        {Number(row.receivedTons).toLocaleString()} {t("tons")}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground" dir="ltr">
                        {Number(row.consumedTons).toLocaleString()} {t("tons")}
                      </TableCell>
                      <TableCell
                        className={`text-center font-semibold ${
                          Number(row.balanceTons) > 0
                            ? "text-emerald-600 dark:text-emerald-500"
                            : "text-muted-foreground"
                        }`}
                        dir="ltr"
                      >
                        {Number(row.balanceTons).toLocaleString()} {t("tons")}
                      </TableCell>
                      <TableCell className="text-center" dir="ltr">
                        {row.avgCostPerTon
                          ? `${Number(row.avgCostPerTon).toLocaleString()} EGP`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                            className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                          >
                            <Link href={`/raw-materials/${row.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          {canWrite && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                                onClick={() => {
                                  setEditItem(row);
                                  setOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => handleDelete(row.id)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {data && data.totalPages > 1 && (
              <PaginationControls
                currentPage={page}
                totalPages={data.totalPages}
                totalItems={data.total}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
