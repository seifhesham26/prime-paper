import { notFound } from "next/navigation";
import { getSettingByKey } from "@/server/settings/db";
import { SignupClient } from "./client";

export const metadata = {
  title: "Sign Up",
};

export default async function SignupPage() {
  const allowSignup = await getSettingByKey("allow_public_signup");

  if (allowSignup?.value !== "true") {
    notFound();
  }

  return <SignupClient />;
}
