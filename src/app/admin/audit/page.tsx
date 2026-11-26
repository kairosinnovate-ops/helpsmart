import { getT } from "@/lib/i18n/server";
import { pageAdmin } from "@/server/page-guards";
import { listCollection } from "@/server/services/admin";
import { formatDate } from "@/lib/i18n/core";
import { PageHeader, Table, Td } from "@/components/ui";

export default async function AdminAudit() {
  await pageAdmin("audit.read");
  const { t, locale } = await getT();
  const logs = await listCollection("auditLogs", 200);
  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.nav.audit")} subtitle="Append-only. No client can write or modify audit records." />
      <Table head={["When", "Actor", "Role", "Action", "Target", "Details"]}>
        {logs.map((l) => (
          <tr key={l.id as string}>
            <Td>{typeof l.at === "number" ? formatDate(l.at, locale) : "—"}</Td>
            <Td className="font-mono text-xs">{(l.actorId as string) ?? "system"}</Td>
            <Td>{l.actorRole as string}</Td>
            <Td className="font-semibold">{l.action as string}</Td>
            <Td className="text-xs">{l.targetType as string}/{l.targetId as string}</Td>
            <Td className="max-w-xs truncate text-xs text-muted">{JSON.stringify(l.metadata ?? {})}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
