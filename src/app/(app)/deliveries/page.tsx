import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { DeliveriesClient } from "@/components/deliveries/ui/DeliveriesClient";

export default async function DeliveriesPage() {
  const t = await getTranslations("deliveries");

  return (
    <>
      <Header title={t("title")} />
      <div className="p-6">
        <DeliveriesClient />
      </div>
    </>
  );
}
