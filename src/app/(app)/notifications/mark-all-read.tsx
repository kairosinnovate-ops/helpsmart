"use client";
import { useT } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { Button } from "@/components/ui";

export function MarkAllRead({ ids }: { ids: string[] }) {
  const { t } = useT();
  const { run, busy } = useAction();
  return <Button size="sm" variant="secondary" loading={busy} onClick={() => run("/api/v1/notifications/read", { ids })}>{t("notifications.markAll")}</Button>;
}
