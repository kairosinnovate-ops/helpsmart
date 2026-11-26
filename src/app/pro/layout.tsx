import { LayoutDashboard, Inbox, Briefcase, Wallet, UserRound, MessageCircle, Settings, ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { pageProvider } from "@/server/page-guards";
import { SideShell } from "@/components/layout/side-shell";

export default async function ProLayout({ children }: { children: React.ReactNode }) {
  await pageProvider("/pro");
  const { t } = await getT();
  const items = [
    { href: "/pro", label: t("nav.dashboard"), icon: <LayoutDashboard className="size-5" />, exact: true },
    { href: "/pro/requests", label: t("nav.requests"), icon: <Inbox className="size-5" /> },
    { href: "/pro/jobs", label: t("nav.jobs"), icon: <Briefcase className="size-5" /> },
    { href: "/messages", label: t("nav.messages"), icon: <MessageCircle className="size-5" /> },
    { href: "/pro/earnings", label: t("nav.earnings"), icon: <Wallet className="size-5" /> },
    { href: "/pro/profile", label: t("nav.profile"), icon: <UserRound className="size-5" /> },
    { href: "/pro/onboarding", label: t("nav.settings"), icon: <Settings className="size-5" /> },
  ];
  return (
    <SideShell suffix="Pro" homeHref="/pro" items={items} footer={<Link href="/home" className="flex items-center gap-2 font-medium text-trust"><ArrowLeftRight className="size-4" /> {t("nav.switchToCustomer")}</Link>}>
      {children}
    </SideShell>
  );
}
