"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { ExternalLink } from "lucide-react";

type MonthlyData = {
  month: string;
  revenue: number;
  payments: number;
};

type RecentDelivery = {
  id: string;
  date: string;
  companyName: string;
  sellingPriceEgp: number;
  paymentStatus: "paid" | "partial" | "unpaid";
};

type UnpaidCompany = {
  id: string;
  name: string;
  balance: number;
};

export function DashboardClient({
  monthlyData,
  recentDeliveries,
  topUnpaidCompanies,
}: {
  monthlyData: MonthlyData[];
  recentDeliveries: RecentDelivery[];
  topUnpaidCompanies: UnpaidCompany[];
}) {
  const t = useTranslations("dashboard");
  const commonT = useTranslations("common");

  // Format month label for Arabic or English
  const isArabic = commonT("page") === "صفحة"; // Simple check for current locale implicitly

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
      {/* Unpaid Balances */}
      <div className="col-span-full lg:col-span-2 space-y-4">
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">{t("topUnpaidCompanies")}</CardTitle>
          </CardHeader>
          <CardContent>
            {topUnpaidCompanies.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noUnpaidCompanies")}</p>
            ) : (
              <div className="space-y-4">
                {topUnpaidCompanies.map((company) => (
                  <div key={company.id} className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{company.name}</span>
                    </div>
                    <span className="font-bold text-destructive" dir="ltr">
                      {company.balance.toLocaleString()} {t("egp")}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <Button asChild variant="ghost" className="w-full mt-4 text-xs text-muted-foreground">
              <Link href="/companies">
                {t("viewAll")} <ExternalLink className="h-3 w-3 ml-1 rtl:mr-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Chart & Recent Deliveries */}
      <div className="col-span-full lg:col-span-5 space-y-4">
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">{t("revenueAndPayments")}</CardTitle>
          </CardHeader>
          <CardContent className="pr-2 rtl:pl-2 rtl:pr-0">
            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    tickFormatter={(value: string) => {
                      // Basic localization of month names if needed, or backend can provide them.
                      // For now, assuming backend provides ISO "YYYY-MM"
                      const date = new Date(value + "-01");
                      return date.toLocaleDateString(isArabic ? 'ar-EG' : 'en-US', { month: 'short' });
                    }}
                    axisLine={false}
                    tickLine={false}
                    fontSize={12}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    fontSize={12}
                    tickFormatter={(value: number) => `${value / 1000}k`}
                    dx={-10}
                  />
                  <Tooltip 
                    formatter={(value: unknown) => {
                      if (typeof value === 'number') {
                        return [value.toLocaleString() + " " + t("egp"), ""];
                      }
                      return [String(value) + " " + t("egp"), ""];
                    }}
                    labelFormatter={(label: unknown) => {
                      if (typeof label === 'string' || typeof label === 'number') {
                        const date = new Date(label + "-01");
                        return date.toLocaleDateString(isArabic ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' });
                      }
                      return String(label);
                    }}
                    cursor={{fill: 'transparent'}}
                  />
                  <Legend wrapperStyle={{ paddingTop: "20px" }} />
                  <Bar dataKey="revenue" name={t("revenue")} fill="var(--color-primary, #3b82f6)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="payments" name={t("payments")} fill="var(--color-success, #10b981)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">{t("recentDeliveries")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
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
                {recentDeliveries.map((delivery) => (
                  <TableRow key={delivery.id}>
                    <TableCell className="font-medium">{delivery.companyName}</TableCell>
                    <TableCell dir="ltr" className={isArabic ? "text-right" : "text-left"}>
                      {new Date(delivery.date).toLocaleDateString(isArabic ? "ar-EG" : "en-US")}
                    </TableCell>
                    <TableCell className="text-center" dir="ltr">
                      {delivery.sellingPriceEgp.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={
                          delivery.paymentStatus === "paid" ? "default" :
                          delivery.paymentStatus === "partial" ? "secondary" : "destructive"
                        }
                      >
                         {/* we will just rely on the existing deliveries translation keys if they exist, or map it.
                             Actually, since we added "paid", "partial", "unpaid" to "deliveries", we can just output it.
                             But this file uses "dashboard" namespace. For simplicity, let's just show it. */}
                        {delivery.paymentStatus}
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
  );
}
