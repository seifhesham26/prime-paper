"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { toast } from "sonner";
import { api } from "@/trpc/react";
import { useUserRole } from "@/hooks/use-role";
import { useConfirm } from "@/components/ui/confirm-dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  ArrowRight,
  ArrowLeft,
  Plus,
  Loader2,
  PackageOpen,
  Trash2,
  Factory,
  TrendingDown,
} from "lucide-react";

export function RawMaterialDetailClient({ typeId }: { typeId: string }) {
  const t = useTranslations("rawMaterials");
  const tc = useTranslations("common");
  const locale = useLocale();
  const isArabic = locale === "ar";
  const { canWrite } = useUserRole();
  const confirm = useConfirm();

  const [receiptOpen, setReceiptOpen] = useState(false);
  const [consumptionOpen, setConsumptionOpen] = useState(false);
  const [consumeWeight, setConsumeWeight] = useState("");
  const [formError, setFormError] = useState("");

  const utils = api.useUtils();
  const { data, isLoading } = api.rawMaterials.getById.useQuery({ id: typeId });

  const invalidate = () => {
    utils.rawMaterials.getById.invalidate({ id: typeId });
    utils.rawMaterials.getAll.invalidate();
    utils.analytics.getDashboardStats.invalidate();
    utils.analytics.evaluateCards.invalidate();
  };

  const addReceipt = api.rawMaterials.createReceipt.useMutation({
    onSuccess: () => {
      toast.success(tc("saved"));
      invalidate();
      setReceiptOpen(false);
      setFormError("");
    },
    onError: (err) => setFormError(err.message),
  });

  const deleteReceipt = api.rawMaterials.deleteReceipt.useMutation({
    onSuccess: () => {
      toast.success(tc("deleted"));
      invalidate();
    },
    // Carries the "would leave a negative balance" guard to the user.
    onError: (err) => toast.error(err.message),
  });

  const addConsumption = api.rawMaterials.createConsumption.useMutation({
    onSuccess: () => {
      toast.success(tc("saved"));
      invalidate();
      setConsumptionOpen(false);
      setConsumeWeight("");
      setFormError("");
    },
    onError: (err) => setFormError(err.message),
  });

  const deleteConsumption = api.rawMaterials.deleteConsumption.useMutation({
    onSuccess: () => {
      toast.success(tc("deleted"));
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const fmtDate = (d: Date | string) =>
    new Date(d).toLocaleDateString(isArabic ? "ar-EG" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <PackageOpen className="h-12 w-12 text-muted-foreground/50" />
        <Button variant="outline" asChild>
          <Link href="/raw-materials">{t("backToMaterials")}</Link>
        </Button>
      </div>
    );
  }

  const handleAddReceipt = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setFormError("");
    addReceipt.mutate({
      typeId,
      dateReceived: new Date(f.get("dateReceived") as string),
      weightTons: f.get("weightTons") as string,
      costEgp: f.get("costEgp") as string,
      notes: (f.get("notes") as string) || undefined,
    });
  };

  const handleAddConsumption = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setFormError("");
    addConsumption.mutate({
      typeId,
      date: new Date(f.get("date") as string),
      weightTons: consumeWeight,
      notes: (f.get("notes") as string) || undefined,
    });
  };

  const handleDeleteReceipt = async (r: (typeof data.receipts)[number]) => {
    const ok = await confirm({
      title: t("confirmDelete"),
      description: `${fmtDate(r.dateReceived)} — ${tc("confirmDeleteDescription")}`,
      confirmLabel: tc("delete"),
      destructive: true,
    });
    if (ok) deleteReceipt.mutate({ id: r.id });
  };

  const handleDeleteConsumption = async (c: (typeof data.consumptions)[number]) => {
    const ok = await confirm({
      title: t("confirmDelete"),
      description: `${fmtDate(c.date)} — ${tc("confirmDeleteDescription")}`,
      confirmLabel: tc("delete"),
      destructive: true,
    });
    if (ok) deleteConsumption.mutate({ id: c.id });
  };

  const balance = Number(data.balanceTons);
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Button variant="ghost" asChild className="gap-2 hover:bg-muted/50 transition-colors">
        <Link href="/raw-materials">
          <ArrowRight className="h-4 w-4 rtl:hidden" />
          <ArrowLeft className="h-4 w-4 hidden rtl:block" />
          {t("backToMaterials")}
        </Link>
      </Button>

      <h2 className="text-2xl font-semibold tracking-tight">{data.name}</h2>
      {data.notes && <p className="text-sm text-muted-foreground -mt-4">{data.notes}</p>}

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: t("received"), value: `${Number(data.receivedTons).toLocaleString()} ${t("tons")}`, tone: "" },
          { label: t("consumed"), value: `${Number(data.consumedTons).toLocaleString()} ${t("tons")}`, tone: "text-muted-foreground" },
          {
            label: t("balance"),
            value: `${balance.toLocaleString()} ${t("tons")}`,
            tone: balance > 0 ? "text-emerald-600 dark:text-emerald-500" : "text-muted-foreground",
          },
          {
            label: t("avgCostPerTon"),
            value: data.avgCostPerTon ? `${Number(data.avgCostPerTon).toLocaleString()} EGP` : "-",
            tone: "",
          },
        ].map((card) => (
          <Card key={card.label} className="border-0 shadow-md bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-medium">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold tracking-tight ${card.tone}`} dir="ltr">
                {card.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Receipts */}
        <Card className="border-0 shadow-md overflow-hidden bg-card/50">
          <CardHeader className="bg-muted/30 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <PackageOpen className="h-5 w-5 text-muted-foreground" />
                {t("receipts")}
              </CardTitle>
              {canWrite && (
                <Dialog
                  open={receiptOpen}
                  onOpenChange={(v) => {
                    setReceiptOpen(v);
                    if (!v) setFormError("");
                  }}
                >
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1 shadow-sm">
                      <Plus className="h-3 w-3" />
                      {t("addReceipt")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md border-0 shadow-2xl bg-background/95 backdrop-blur">
                    <DialogHeader>
                      <DialogTitle className="text-xl">{t("addReceipt")}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddReceipt} className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor="dateReceived" className="text-muted-foreground">
                          {t("dateReceived")}
                        </Label>
                        <Input id="dateReceived" name="dateReceived" type="date" defaultValue={today} required dir="ltr" className="bg-muted/50" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="weightTons" className="text-muted-foreground">
                            {t("weightTons")}
                          </Label>
                          <Input id="weightTons" name="weightTons" type="number" step="0.001" min="0.001" required dir="ltr" className="bg-muted/50" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="costEgp" className="text-muted-foreground">
                            {t("costEgp")}
                          </Label>
                          <Input id="costEgp" name="costEgp" type="number" step="0.01" min="0" required dir="ltr" className="bg-muted/50" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="receiptNotes" className="text-muted-foreground">
                          {t("notes")}
                        </Label>
                        <Textarea id="receiptNotes" name="notes" className="bg-muted/50" />
                      </div>
                      {formError && (
                        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg py-3 px-4">
                          {formError}
                        </div>
                      )}
                      <div className="flex gap-3 justify-end pt-2">
                        <Button type="button" variant="ghost" onClick={() => setReceiptOpen(false)}>
                          {t("cancel")}
                        </Button>
                        <Button type="submit" disabled={addReceipt.isPending} className="min-w-[100px]">
                          {addReceipt.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {data.receipts.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {t("noReceipts")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-muted/20">
                      <TableHead className="font-semibold">{t("dateReceived")}</TableHead>
                      <TableHead className="text-center font-semibold">{t("weightTons")}</TableHead>
                      <TableHead className="text-center font-semibold">{t("costEgp")}</TableHead>
                      <TableHead className="text-center font-semibold">{t("costPerTon")}</TableHead>
                      {canWrite && <TableHead className="w-[50px]" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.receipts.map((r) => (
                      <TableRow key={r.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell dir="ltr" className="text-start whitespace-nowrap">
                          {fmtDate(r.dateReceived)}
                        </TableCell>
                        <TableCell className="text-center font-medium" dir="ltr">
                          {Number(r.weightTons).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center" dir="ltr">
                          {Number(r.costEgp).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground" dir="ltr">
                          {r.costPerTon ? Number(r.costPerTon).toLocaleString() : "-"}
                        </TableCell>
                        {canWrite && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteReceipt(r)}
                              disabled={deleteReceipt.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Consumptions */}
        <Card className="border-0 shadow-md overflow-hidden bg-card/50">
          <CardHeader className="bg-muted/30 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingDown className="h-5 w-5 text-muted-foreground" />
                {t("consumptions")}
              </CardTitle>
              {canWrite && (
                <Dialog
                  open={consumptionOpen}
                  onOpenChange={(v) => {
                    setConsumptionOpen(v);
                    if (!v) {
                      setFormError("");
                      setConsumeWeight("");
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button size="sm" variant="secondary" className="gap-1 shadow-sm" disabled={balance <= 0}>
                      <Plus className="h-3 w-3" />
                      {t("addConsumption")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md border-0 shadow-2xl bg-background/95 backdrop-blur">
                    <DialogHeader>
                      <DialogTitle className="text-xl">{t("addConsumption")}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddConsumption} className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor="date" className="text-muted-foreground">
                          {t("consumptionDate")}
                        </Label>
                        <Input id="date" name="date" type="date" defaultValue={today} required dir="ltr" className="bg-muted/50" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="consumeWeight" className="text-muted-foreground">
                            {t("weightTons")}
                          </Label>
                          {/* Saves doing the subtraction by hand when a
                              material is fully converted. */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setConsumeWeight(data.balanceTons)}
                          >
                            {t("consumeAll")}
                          </Button>
                        </div>
                        <Input
                          id="consumeWeight"
                          type="number"
                          step="0.001"
                          min="0.001"
                          max={data.balanceTons}
                          value={consumeWeight}
                          onChange={(e) => setConsumeWeight(e.target.value)}
                          required
                          dir="ltr"
                          className="bg-muted/50"
                        />
                        <p className="text-xs text-muted-foreground" dir="ltr">
                          {t("balance")}: {balance.toLocaleString()} {t("tons")}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="consumptionNotes" className="text-muted-foreground">
                          {t("notes")}
                        </Label>
                        <Textarea id="consumptionNotes" name="notes" className="bg-muted/50" />
                      </div>
                      {formError && (
                        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg py-3 px-4">
                          {formError}
                        </div>
                      )}
                      <div className="flex gap-3 justify-end pt-2">
                        <Button type="button" variant="ghost" onClick={() => setConsumptionOpen(false)}>
                          {t("cancel")}
                        </Button>
                        <Button type="submit" disabled={addConsumption.isPending} className="min-w-[100px]">
                          {addConsumption.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {data.consumptions.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {t("noConsumptions")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-muted/20">
                      <TableHead className="font-semibold">{t("consumptionDate")}</TableHead>
                      <TableHead className="text-center font-semibold">{t("weightTons")}</TableHead>
                      <TableHead className="font-semibold">{t("notes")}</TableHead>
                      {canWrite && <TableHead className="w-[50px]" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.consumptions.map((c) => (
                      <TableRow key={c.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell dir="ltr" className="text-start whitespace-nowrap">
                          {fmtDate(c.date)}
                        </TableCell>
                        <TableCell className="text-center font-medium" dir="ltr">
                          {Number(c.weightTons).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[150px] truncate">
                          {c.notes || "-"}
                        </TableCell>
                        {canWrite && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteConsumption(c)}
                              disabled={deleteConsumption.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rolls produced — informational. Consumption is recorded by hand, so
          this is where a mismatch between the two becomes visible. */}
      <Card className="border-0 shadow-md overflow-hidden bg-card/50">
        <CardHeader className="bg-muted/30">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Factory className="h-5 w-5 text-muted-foreground" />
            {t("linkedProducts")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.products.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t("noLinkedProducts")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-muted/20">
                    <TableHead className="font-semibold">{t("dateProduced")}</TableHead>
                    <TableHead className="font-semibold">{t("dimensions")}</TableHead>
                    <TableHead className="text-center font-semibold">{t("quantity")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.products.map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell dir="ltr" className="text-start whitespace-nowrap">
                        {fmtDate(p.dateProduced)}
                      </TableCell>
                      <TableCell dir="ltr" className="text-start">
                        {p.lengthM}m × {p.widthCm}cm{" "}
                        <span className="text-muted-foreground">({p.weightKg}kg)</span>
                      </TableCell>
                      <TableCell className="text-center font-medium">{p.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
