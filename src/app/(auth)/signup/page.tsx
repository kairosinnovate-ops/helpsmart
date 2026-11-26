import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Join HelpSmart" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const user = await getSessionUser();
  if (user?.doc) redirect("/home");
  const initial = type === "customer" || type === "provider" ? type : null;
  // Signed in with Firebase but HelpSmart account not created yet → finish account creation only.
  return <SignupForm initialType={initial} completeOnly={!!user && !user.doc} />;
}
