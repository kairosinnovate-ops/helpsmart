import { getT } from "@/lib/i18n/server";
import { pageAdmin } from "@/server/page-guards";
import { searchUsers } from "@/server/services/admin";
import { hasPermission } from "@/domain/permissions";
import { formatDate } from "@/lib/i18n/core";
import { Button, Input, PageHeader, Pill, Table, Td } from "@/components/ui";
import { IdentityPill } from "@/components/trust";
import { AdminAction } from "../admin-client";
import type { IdentityStatus } from "@/domain/types";

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const a = await pageAdmin("users.read");
  const { t, locale } = await getT();
  const users = await searchUsers(q ?? "");
  const canSuspend = hasPermission(a.adminRole, "users.suspend");
  const canDelete = hasPermission(a.adminRole, "users.delete");
  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.nav.users")} subtitle="Search by exact email, +251 phone, or user ID." />
      <form className="flex gap-2"><Input name="q" defaultValue={q} aria-label={t("common.search")} placeholder="name@example.com / +2519… / uid" className="max-w-md" /><Button type="submit">{t("common.search")}</Button></form>
      <Table head={["Name", "Roles", "Identity", "Account", "Created", "Actions"]}>
        {users.map((u) => (
          <tr key={u.uid}>
            <Td><p className="font-semibold">{u.displayName}</p><p className="text-xs text-muted">{u.email}</p></Td>
            <Td>{u.roles.join(", ")}</Td>
            <Td><IdentityPill status={u.identityStatus as IdentityStatus} t={t} /></Td>
            <Td><Pill tone={u.accountStatus === "active" ? "green" : "red"}>{u.accountStatus}</Pill></Td>
            <Td>{u.createdAt ? formatDate(u.createdAt, locale, { dateStyle: "medium" }) : "—"}</Td>
            <Td className="space-x-2 whitespace-nowrap">
              {canSuspend && (u.accountStatus === "suspended" ? <AdminAction path={`/api/admin/users/${u.uid}`} body={{ action: "restore" }} label="Restore" withNote /> : <AdminAction path={`/api/admin/users/${u.uid}`} body={{ action: "suspend" }} label="Suspend" variant="danger" withNote />)}
              {canDelete && u.accountStatus === "deletion_requested" && <AdminAction path={`/api/admin/users/${u.uid}`} body={{ action: "delete" }} label="Process deletion" variant="danger" withNote />}
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
