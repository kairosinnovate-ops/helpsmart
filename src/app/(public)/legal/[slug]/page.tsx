import { notFound } from "next/navigation";
import { LEGAL } from "@/content/pages";
import { ContentView } from "@/components/content-page";
import { getT } from "@/lib/i18n/server";

export function generateStaticParams() {
  return Object.keys(LEGAL).map((slug) => ({ slug }));
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = LEGAL[slug];
  if (!page) notFound();
  const { t } = await getT();
  return <ContentView page={page} draftNotice={t("legal.draftNotice")} />;
}
