import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { pageUser } from "@/server/page-guards";
import { listConversations } from "@/server/services/messaging";
import { formatDate } from "@/lib/i18n/core";
import { Avatar, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const u = await pageUser("/messages");
  const { t, locale } = await getT();
  const convs = await listConversations(u.uid);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("messages.title")} />
      {convs.length === 0 ? (
        <EmptyState icon={<MessageCircle className="size-6" />} title={t("messages.none")} body={t("messages.noneBody")} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-white">
          {convs.map((c) => (
            <li key={c.id}>
              <Link href={`/messages/${c.id}`} className="flex items-center gap-4 p-4 hover:bg-canvas">
                <Avatar name={c.otherName} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2"><p className="truncate font-semibold text-ink">{c.otherName}</p><p className="shrink-0 text-xs text-muted">{c.lastMessageAt ? formatDate(c.lastMessageAt, locale, { dateStyle: "short", timeStyle: "short" }) : ""}</p></div>
                  <p className="truncate text-sm text-muted">{c.lastMessage ?? "—"}</p>
                </div>
                {c.unread > 0 && <span className="grid min-w-6 place-items-center rounded-full bg-trust px-1.5 text-xs font-bold text-white" aria-label={`${c.unread} unread`}>{c.unread}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
