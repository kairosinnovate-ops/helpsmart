import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { isLocale, LOCALE_COOKIE, makeList, makeT } from "./core";
import type { Locale } from "@/domain/types";

export const getLocale = cache(async (): Promise<Locale> => {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  const accept = (await headers()).get("accept-language") ?? "";
  const first = accept.split(",")[0]?.split("-")[0];
  return isLocale(first) ? first : "en";
});

export async function getT() {
  const locale = await getLocale();
  return { t: makeT(locale), list: makeList(locale), locale };
}
