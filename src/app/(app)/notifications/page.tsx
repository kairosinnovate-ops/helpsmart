import Link from "next/link";
import { Bell } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { pageUser } from "@/server/page-guards";
import { listNotifications } from "@/server/services/notifications";
import { formatDate } from "@/lib/i18n/core";
import { EmptyState, PageHeader } from "@/components/ui";
import { MarkAllRead } from "./mark-all-read";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const u = await pageUser("/notifications");
  const { t, locale } = await getT();
  const items = await listNotifications(u.uid, 50);
  const unread = items.filter((n) => !n.read).map((n) => n.id);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("notifications.title")} actions={unread.length ? <MarkAllRead ids={unread} /> : undefined} />
      {items.length === 0 ? (
        <EmptyState icon={<Bell className="size-6" />} title={t("notifications.none")} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-white">
          {items.map((n) => {
            const inner = (
              <div className="flex gap-3 p-4">
                <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-trust"}`} aria-hidden />
                <div className="flex-1">
                  <p className={`text-ink ${n.read ? "" : "font-semibold"}`}>{n.title}</p>
                  <p className="text-sm text-muted">{n.body}</p>
                  <p className="mt-1 text-xs text-muted">{formatDate(n.createdAt, locale)}</p>
                </div>
              </div>
            );
            return <li key={n.id}>{n.link ? <Link href={n.link} className="block hover:bg-canvas">{inner}</Link> : inner}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
