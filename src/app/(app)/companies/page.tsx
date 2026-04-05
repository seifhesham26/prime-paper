import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { CompaniesClient } from "@/components/companies/ui/CompaniesClient";

export default async function CompaniesPage() {
  const t = await getTranslations("companies");

  return (
    <>
      <Header title={t("title")} />
      <div className="p-6">
        <CompaniesClient />
      </div>
    </>
  );
}
