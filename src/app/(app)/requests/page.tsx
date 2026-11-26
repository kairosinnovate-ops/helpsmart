import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { pageUser } from "@/server/page-guards";
import { listMyRequests } from "@/server/services/requests";
import { formatDate } from "@/lib/i18n/core";
import { ButtonLink, EmptyState, PageHeader, Pill } from "@/components/ui";

export const metadata = { title: "My requests" };

export default async function RequestsPage() {
  const u = await pageUser("/requests");
  const { t, locale } = await getT();
  const reqs = await listMyRequests(u.uid);
  return (
    <div>
      <PageHeader title={t("requests.mine")} actions={<ButtonLink href="/requests/new" size="sm">{t("nav.postRequest")}</ButtonLink>} />
      {reqs.length === 0 ? (
        <EmptyState icon={<FilePlus2 className="size-6" />} title={t("requests.none")} body={t("requests.newBody")} action={<ButtonLink href="/requests/new">{t("nav.postRequest")}</ButtonLink>} />
      ) : (
        <ul className="space-y-3">
          {reqs.map((r) => (
            <li key={r.id}>
              <Link href={`/requests/${r.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 hover:border-trust/30">
                <div>
                  <p className="font-semibold text-ink">{r.title}</p>
                  <p className="text-sm text-muted">{r.neighborhoodName ?? r.subCityName} · {formatDate(r.createdAt, locale, { dateStyle: "medium" })} · {r.quoteCount} {t("requests.quotes").toLowerCase()}</p>
                </div>
                <Pill tone={r.status === "open" ? "blue" : r.status === "awarded" ? "green" : "neutral"}>{t(`requests.statuses.${r.status}`)}</Pill>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
