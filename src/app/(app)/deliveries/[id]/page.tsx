import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { DeliveryDetailClient } from "@/components/deliveries/ui/DeliveryDetailClient";

export default async function DeliveryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("deliveries");

  return (
    <>
      <Header title={t("title")} />
      <div className="p-6">
        <DeliveryDetailClient deliveryId={id} />
      </div>
    </>
  );
}
