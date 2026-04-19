"use client";

import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { ExternalLink, Settings2 } from "lucide-react";
import { api } from "@/trpc/react";
import { useUserRole } from "@/hooks/use-role";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { StatCard } from "./StatCard";

export function AnalyticsClient() {
  const t = useTranslations("dashboard");
  const ts = useTranslations("settings");
  const locale = useLocale();
  const isArabic = locale === "ar";
  const { canWrite } = useUserRole();

  const { data: stats, isLoading } = api.analytics.getDashboardStats.useQuery();
  const { data: dynamicCards, isLoading: isLoadingCards } = api.analytics.evaluateCards.useQuery();

  if (isLoading || isLoadingCards || !stats) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[120px] rounded-xl bg-muted/60" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <div className="h-[400px] w-full col-span-full lg:col-span-2 rounded-xl bg-muted/60" />
          <div className="h-[400px] w-full col-span-full lg:col-span-5 rounded-xl bg-muted/60" />
        </div>
      </div>
    );
  }

  // Unit translation map
  const unitLabels: Record<string, string> = {
    tons: t("tons"),
    rolls: t("rolls"),
    egp: t("egp"),
    kg: "kg",
    count: "",
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 fill-mode-forwards">
      {canWrite && (
        <div className="flex justify-end">
          <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs shadow-sm hover:shadow-md transition-all">
            <Link href="/settings?tab=cards">
              <Settings2 className="h-3.5 w-3.5" />
              {ts("manageCards")}
            </Link>
          </Button>
        </div>
      )}
      <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-${Math.min(dynamicCards?.length || 4, 4)}`}>
        {dynamicCards ? dynamicCards.map((card) => (
          <StatCard
            key={card.id}
            title={isArabic ? card.titleAr : card.title}
            value={card.value}
            unit={unitLabels[card.unit] ?? card.unit}
            icon={card.icon}
            gradient={card.gradient}
          />
        )) : (
          // Fallback while loading dynamic cards
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[120px] rounded-xl bg-muted/60 animate-pulse" />
          ))
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Unpaid Balances */}
        <div className="col-span-full lg:col-span-2 space-y-4">
          <Card className="border-0 shadow-md h-full flex flex-col hover:shadow-lg transition-shadow duration-300 dark:bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg">{t("topUnpaidCompanies")}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between">
              {stats.topUnpaidCompanies.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noUnpaidCompanies")}</p>
              ) : (
                <div className="space-y-5 mb-4 px-1">
                  {stats.topUnpaidCompanies.map((company) => (
                    <div key={company.id} className="flex items-center justify-between group">
                      <span className="font-medium text-sm group-hover:text-primary transition-colors">
                        {company.name}
                      </span>
                      <span className="font-bold text-destructive" dir="ltr">
                        {company.balance.toLocaleString()} {t("egp")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <Button asChild variant="outline" className="w-full text-xs mt-2 hover:bg-muted/50 transition-colors">
                <Link href="/companies">
                  {t("viewAll")} <ExternalLink className="h-3 w-3 ml-1 rtl:mr-1" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Chart & Recent Deliveries */}
        <div className="col-span-full lg:col-span-5 space-y-4">
          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300 dark:bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg">{t("revenueAndPayments")}</CardTitle>
            </CardHeader>
            <CardContent className="pr-2 rtl:pl-2 rtl:pr-0">
              <div className="h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border, #e5e7eb)" />
                    <XAxis 
                      dataKey="month" 
                      tickFormatter={(value) => {
                        const date = new Date(value + "-01");
                        return date.toLocaleDateString(isArabic ? 'ar-EG' : 'en-US', { month: 'short' });
                      }}
                      axisLine={false}
                      tickLine={false}
                      fontSize={12}
                      dy={10}
                      tick={{ fill: "var(--color-muted-foreground, #6b7280)" }}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      fontSize={12}
                      tickFormatter={(value) => `${value / 1000}k`}
                      dx={-10}
                      tick={{ fill: "var(--color-muted-foreground, #6b7280)" }}
                    />
                    <Tooltip 
                      formatter={(value: unknown) => [Number(value).toLocaleString() + " " + t("egp"), ""]}
                      labelFormatter={(label: unknown) => {
                        const date = new Date(String(label) + "-01");
                        return date.toLocaleDateString(isArabic ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' });
                      }}
                      cursor={{fill: 'var(--color-accent, #f3f4f6)', opacity: 0.2}}
                      contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                    />
                    <Legend wrapperStyle={{ paddingTop: "20px" }} />
                    <Bar dataKey="revenue" name={t("revenue")} fill="var(--color-chart-1, #3b82f6)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="payments" name={t("payments")} fill="var(--color-chart-2, #10b981)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300 dark:bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg">{t("recentDeliveries")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto overflow-y-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={isArabic ? "text-right" : "text-left"}>{t("company")}</TableHead>
                    <TableHead className={isArabic ? "text-right" : "text-left"}>{t("date")}</TableHead>
                    <TableHead className="text-center">{t("amount")}</TableHead>
                    <TableHead className="text-center">{t("status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recentDeliveries.map((delivery) => (
                    <TableRow key={delivery.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium whitespace-nowrap">{delivery.companyName}</TableCell>
                      <TableCell dir="ltr" className={isArabic ? "text-right whitespace-nowrap" : "text-left whitespace-nowrap"}>
                        {new Date(delivery.date).toLocaleDateString(isArabic ? "ar-EG" : "en-US")}
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap" dir="ltr">
                        {delivery.sellingPriceEgp.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        <Badge 
                          variant={
                            delivery.paymentStatus === "paid" ? "default" :
                            delivery.paymentStatus === "partial" ? "secondary" : "destructive"
                          }
                        >
                          {t(delivery.paymentStatus)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="p-4 pt-2 flex justify-end">
                 <Button asChild variant="link" className="text-sm p-0 h-auto">
                  <Link href="/deliveries">
                    {t("viewAll")} <ExternalLink className="h-3 w-3 ml-1 rtl:mr-1" />
                  </Link>
                 </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
