import { getTranslations } from "next-intl/server";
import { getRawMaterialsService } from "@/server/raw-materials/services";
import { Header } from "@/components/layout/header";
import { ProductsClient } from "@/components/products/ui/ProductsClient";

export default async function ProductsPage() {
  const t = await getTranslations("products");
  const rawMaterialsList = await getRawMaterialsService(1, 100);

  return (
    <>
      <Header title={t("title")} />
      <div className="p-6">
        <ProductsClient
          rawMaterials={JSON.parse(JSON.stringify(rawMaterialsList.data || rawMaterialsList))}
        />
      </div>
    </>
  );
}
