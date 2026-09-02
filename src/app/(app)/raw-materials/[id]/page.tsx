import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { RawMaterialDetailClient } from "@/components/raw-materials/ui/RawMaterialDetailClient";

export default async function RawMaterialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("rawMaterials");

  return (
    <>
      <Header
        title={t("materialDetail")}
        breadcrumb={{ href: "/raw-materials", label: t("title") }}
      />
      <div className="p-6">
        <RawMaterialDetailClient typeId={id} />
      </div>
    </>
  );
}
