"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { api } from "@/trpc/react";
import { useUserRole } from "@/hooks/use-role";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { ArrowRight, ArrowLeft, Plus, CreditCard, Loader2, PackageOpen, Trash2 } from "lucide-react";

function PaymentBadge({ status }: { status: string | null }) {
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

export function DeliveryDetailClient({ deliveryId }: { deliveryId: string }) {
  const t = useTranslations("deliveries");
  const locale = useLocale();
  const isArabic = locale === "ar";
  const { canWrite } = useUserRole();
  const [paymentOpen, setPaymentOpen] = useState(false);

  const utils = api.useUtils();
  const { data: delivery, isLoading } = api.deliveries.getById.useQuery({ id: deliveryId });

  const invalidate = () => {
    utils.deliveries.getById.invalidate({ id: deliveryId });
    utils.deliveries.getAll.invalidate();
    utils.analytics.getDashboardStats.invalidate();
    utils.analytics.evaluateCards.invalidate();
  };

  const addPaymentMutation = api.deliveries.addPayment.useMutation({
    onSuccess: () => {
      invalidate();
      setPaymentOpen(false);
    },
    onError: (err) => alert(err.message),
  });

  // Deleting a payment recomputes the delivery's status server-side.
  const deletePaymentMutation = api.deliveries.deletePayment.useMutation({
    onSuccess: invalidate,
    onError: (err) => alert(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <PackageOpen className="h-12 w-12 text-muted-foreground/50" />
        <p className="text-lg text-muted-foreground">{t("deliveryNotFound")}</p>
        <Button variant="outline" asChild>
          <Link href="/deliveries">{t("backToDeliveries")}</Link>
        </Button>
      </div>
    );
  }

  const handleAddPayment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    addPaymentMutation.mutate({
      deliveryId: delivery.id,
      amountEgp: formData.get("amount") as string,
      date: new Date(formData.get("paymentDate") as string),
      notes: formData.get("notes") as string || undefined,
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Button variant="ghost" asChild className="gap-2 hover:bg-muted/50 transition-colors">
        <Link href="/deliveries">
          <ArrowRight className="h-4 w-4 rtl:hidden" />
          <ArrowLeft className="h-4 w-4 ltr:hidden" />
          {t("title")}
        </Link>
      </Button>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-md bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              {t("company")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <p className="text-xl font-semibold">{delivery.companyName}</p>
              <div className="flex">
                <PaymentBadge status={delivery.paymentStatus} />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              {t("sellingPrice")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tracking-tight" dir="ltr">
              {Number(delivery.sellingPriceEgp).toLocaleString()} EGP
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              {t("totalPaid")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-500" dir="ltr">
              {delivery.totalPaid.toLocaleString()} EGP
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              {t("remaining")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold tracking-tight ${
                delivery.remaining > 0 ? "text-rose-600 dark:text-rose-500" : "text-emerald-600 dark:text-emerald-500"
              }`}
              dir="ltr"
            >
              {delivery.remaining.toLocaleString()} EGP
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Delivery Items */}
        <Card className="border-0 shadow-md overflow-hidden bg-card/50">
          <CardHeader className="bg-muted/30">
            <CardTitle className="flex items-center gap-2 text-lg">
              <PackageOpen className="h-5 w-5 text-muted-foreground" />
              {t("items")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {delivery.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <p className="text-sm">{t("emptyItems")}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-muted/20">
                    <TableHead className="font-semibold">{t("product")}</TableHead>
                    <TableHead className="text-center font-semibold w-[100px]">
                      {t("quantity")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {delivery.items.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell dir="ltr" className="text-start font-medium">
                        {item.lengthM}m × {item.widthCm}cm <span className="text-muted-foreground font-normal">({item.weightKg}kg)</span>
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {item.quantity}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Payments */}
        <Card className="border-0 shadow-md overflow-hidden bg-card/50">
          <CardHeader className="bg-muted/30 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                {t("payments")}
              </CardTitle>
              {canWrite && <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1 shadow-sm hover:shadow-md transition-all">
                    <Plus className="h-3 w-3" />
                    {t("addPayment")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md border-0 shadow-2xl bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
                  <DialogHeader>
                    <DialogTitle className="text-xl">{t("addPayment")}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddPayment} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="amount" className="text-muted-foreground">{t("amount")}</Label>
                      <Input
                        id="amount"
                        name="amount"
                        type="number"
                        step="0.01"
                        required
                        dir="ltr"
                        className="bg-muted/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="paymentDate" className="text-muted-foreground">{t("paymentDate")}</Label>
                      <Input
                        id="paymentDate"
                        name="paymentDate"
                        type="date"
                        defaultValue={new Date().toISOString().split("T")[0]}
                        required
                        dir="ltr"
                        className="bg-muted/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes" className="text-muted-foreground">{t("notes")}</Label>
                      <Textarea id="notes" name="notes" className="bg-muted/50" />
                    </div>
                    <div className="flex gap-3 justify-end pt-4">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setPaymentOpen(false)}
                        className="hover:bg-muted/50"
                      >
                        {t("cancel")}
                      </Button>
                      <Button type="submit" disabled={addPaymentMutation.isPending} className="min-w-[100px] shadow-sm">
                        {addPaymentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {delivery.payments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <p className="text-sm">{t("emptyPayments")}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-muted/20">
                    <TableHead className="font-semibold">{t("paymentDate")}</TableHead>
                    <TableHead className="text-center font-semibold">{t("amount")}</TableHead>
                    <TableHead className="font-semibold">{t("notes")}</TableHead>
                    {canWrite && <TableHead className="w-[50px]" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {delivery.payments.map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell dir="ltr" className="text-start text-muted-foreground whitespace-nowrap">
                        {new Date(p.date).toLocaleDateString(isArabic ? "ar-EG" : "en-US", { year: 'numeric', month: 'short', day: 'numeric' })}
                      </TableCell>
                      <TableCell className="text-center font-medium text-emerald-600 dark:text-emerald-500" dir="ltr">
                        {Number(p.amountEgp).toLocaleString()} EGP
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[150px] truncate">{p.notes || "-"}</TableCell>
                      {canWrite && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            title={t("deletePayment")}
                            onClick={() => {
                              if (confirm(t("confirmDeletePayment"))) {
                                deletePaymentMutation.mutate({ id: p.id });
                              }
                            }}
                            disabled={deletePaymentMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
