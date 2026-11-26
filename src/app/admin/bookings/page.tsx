import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { pageAdmin } from "@/server/page-guards";
import { listAllBookings, listCollection } from "@/server/services/admin";
import { hasPermission } from "@/domain/permissions";
import { formatEtb } from "@/domain/pricing";
import { formatDate } from "@/lib/i18n/core";
import { PageHeader, SectionHeading, Table, Td } from "@/components/ui";
import { BookingPill, PaymentPill } from "@/components/trust";
import { AdminAction } from "../admin-client";
import type { BookingStatus, PaymentStatus } from "@/domain/types";

export default async function AdminBookings() {
  const a = await pageAdmin("bookings.read");
  const { t, locale } = await getT();
  const [bookings, disputes] = await Promise.all([listAllBookings(), listCollection("disputes")]);
  const canIntervene = hasPermission(a.adminRole, "bookings.intervene");
  const canRefund = hasPermission(a.adminRole, "finance.refund");
  return (
    <div className="space-y-8">
      <PageHeader title={t("admin.nav.bookings")} />
      <section>
        <SectionHeading title="Disputes" />
        <Table head={["Booking", "Opened by", "Reason", "Status", "Actions"]}>
          {disputes.map((d) => (
            <tr key={d.id as string}>
              <Td className="font-mono text-xs">{d.bookingId as string}</Td><Td>{d.openedByRole as string}</Td><Td className="max-w-xs truncate">{d.reason as string}</Td><Td>{d.status as string}</Td>
              <Td className="space-x-2 whitespace-nowrap">{d.status === "open" && canIntervene && <><AdminAction path={`/api/admin/bookings/${d.bookingId}`} body={{ action: "resolve_completed" }} label="Resolve: completed" withNote />{canRefund && <AdminAction path={`/api/admin/bookings/${d.bookingId}`} body={{ action: "resolve_refund" }} label="Resolve: refund" variant="danger" withNote />}</>}</Td>
            </tr>
          ))}
        </Table>
      </section>
      <section>
        <SectionHeading title="Recent bookings" />
        <Table head={["Ref", "Created", "Customer", "Professional", "Category", "Total", "Status", "Payment", ""]}>
          {bookings.map((b) => (
            <tr key={b.id}>
              <Td className="font-semibold">{b.reference}</Td><Td>{formatDate(b.createdAt, locale, { dateStyle: "short" })}</Td><Td>{b.customerName}</Td><Td>{b.providerName}</Td><Td>{b.categoryId}</Td>
              <Td>{b.totalMinor != null ? formatEtb(b.totalMinor, locale) : "—"}</Td>
              <Td><BookingPill status={b.status as BookingStatus} t={t} /></Td><Td><PaymentPill status={b.paymentStatus as PaymentStatus} t={t} /></Td>
              <Td>{b.status === "refund_pending" && canRefund ? <AdminAction path={`/api/admin/bookings/${b.id}`} body={{ action: "mark_refunded" }} label="Mark refunded" withNote /> : <Link href={`/admin/bookings`} className="sr-only">—</Link>}</Td>
            </tr>
          ))}
        </Table>
      </section>
    </div>
  );
}
