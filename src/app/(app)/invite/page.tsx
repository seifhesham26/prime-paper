import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { InviteClient } from "./client";

export default async function InvitePage() {
  const session = await getSession();

  if (!session || (session.user.role !== "dev" && session.user.role !== "admin")) {
    redirect("/");
  }

  const t = await getTranslations("invite");

  return (
    <>
      <Header title={t("title")} />
      <div className="p-6">
        <InviteClient />
      </div>
    </>
  );
}
