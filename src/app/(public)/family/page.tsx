import type { Metadata } from "next";
import { PAGES } from "@/content/pages";
import { ContentView } from "@/components/content-page";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: PAGES["family"].title };

export default async function Page() {
  const { t } = await getT();
  void t;
  return <ContentView page={PAGES["family"]}  />;
}
