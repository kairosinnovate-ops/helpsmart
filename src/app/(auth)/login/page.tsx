import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // Only allow same-site relative redirects.
  const safeNext = next && /^\/(?![\/\\])/.test(next) ? next : "/home";
  return <LoginForm next={safeNext} />;
}
