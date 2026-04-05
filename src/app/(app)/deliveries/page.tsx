import { getTranslations } from "next-intl/server";
import { getProductsService } from "@/server/products/services";
import { Header } from "@/components/layout/header";
import { DeliveriesClient } from "@/components/deliveries/ui/DeliveriesClient";

export default async function DeliveriesPage() {
  const t = await getTranslations("deliveries");
  const productsList = await getProductsService(1, 1000);

  return (
    <>
      <Header title={t("title")} />
      <div className="p-6">
        <DeliveriesClient
          products={JSON.parse(JSON.stringify(productsList.data || productsList))}
        />
      </div>
    </>
  );
}
