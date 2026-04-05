import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { AnalyticsClient } from "@/components/analytics/ui/AnalyticsClient";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");

  return (
    <>
      <Header title={t("title")} />
      <div className="p-6">
        <AnalyticsClient />
      </div>
    </>
  );
}
