import { notFound } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { pageUser } from "@/server/page-guards";
import { getRequestWithQuotes } from "@/server/services/requests";
import { ApiError } from "@/server/errors";
import { formatEtb } from "@/domain/pricing";
import { Card, EmptyState, PageHeader, Pill, SectionHeading, Stars } from "@/components/ui";
import { BadgeRow } from "@/components/trust";
import { AcceptQuote, CloseRequest } from "./request-client";
import type { BadgeId } from "@/domain/badges";

export default async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await pageUser(`/requests/${id}`);
  const { t, locale } = await getT();
  let data;
  try {
    data = await getRequestWithQuotes(u.uid, id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const { request: r, quotes } = data;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={r.title} subtitle={`${r.neighborhoodName ?? r.subCityName}${r.budgetMinor ? ` · ${formatEtb(r.budgetMinor, locale)}` : ""}`} actions={<Pill tone={r.status === "open" ? "blue" : "green"}>{t(`requests.statuses.${r.status}`)}</Pill>} />
      <Card className="p-6"><p className="whitespace-pre-line text-ink/80">{r.description}</p>{r.status === "open" && <div className="mt-4"><CloseRequest id={r.id} /></div>}</Card>
      <section>
        <SectionHeading title={`${t("requests.quotes")} (${quotes.length})`} />
        {quotes.length === 0 ? (
          <EmptyState title={t("requests.noQuotes")} />
        ) : (
          <ul className="space-y-3">
            {quotes.map((q) => (
              <li key={q.id}>
                <Card className="p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-ink">{q.providerName}</p>
                      <div className="mt-1 flex items-center gap-3 text-sm"><Stars value={q.ratingAverage} count={q.ratingCount} /><span className="text-muted">{t("provider.jobs", { n: q.completedJobs })}</span></div>
                      <div className="mt-2"><BadgeRow ids={q.badges as BadgeId[]} t={t} /></div>
                    </div>
                    <p className="text-2xl font-semibold text-trust">{formatEtb(q.amountMinor, locale)}</p>
                  </div>
                  <p className="mt-3 text-sm text-ink/80">{q.note}</p>
                  <p className="mt-1 text-xs text-muted">{[q.estimatedDuration && `${t("booking.estimatedDuration")}: ${q.estimatedDuration}`, q.availableFrom && `${t("requests.availableFrom")}: ${q.availableFrom}`].filter(Boolean).join(" · ")}</p>
                  {r.status === "open" && q.status === "submitted" && q.stillAvailable && <div className="mt-4"><AcceptQuote quoteId={q.id} /></div>}
                  {q.status !== "submitted" && <Pill className="mt-3" tone={q.status === "accepted" ? "green" : "neutral"}>{q.status}</Pill>}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
