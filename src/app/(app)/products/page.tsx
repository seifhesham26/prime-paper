import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { ProductsClient } from "@/components/products/ui/ProductsClient";

export default async function ProductsPage() {
  const t = await getTranslations("products");

  return (
    <>
      <Header title={t("title")} />
      <div className="p-6">
        <ProductsClient />
      </div>
    </>
  );
}
