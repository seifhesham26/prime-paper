import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { RawMaterialsClient } from "@/components/raw-materials/ui/RawMaterialsClient";

export default async function RawMaterialsPage() {
  const t = await getTranslations("rawMaterials");

  return (
    <>
      <Header title={t("title")} />
      <div className="p-6">
        <RawMaterialsClient />
      </div>  
    </>
  );
}
