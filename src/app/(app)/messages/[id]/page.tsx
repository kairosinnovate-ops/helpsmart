import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { pageUser } from "@/server/page-guards";
import { getConversation } from "@/server/services/messaging";
import { adminDb } from "@/server/firebase/admin";
import { C } from "@/server/collections";
import { ApiError } from "@/server/errors";
import { Avatar } from "@/components/ui";
import { Thread } from "./thread";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await pageUser(`/messages/${id}`);
  const { t } = await getT();
  let conv;
  try {
    conv = await getConversation(u.uid, id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const snap = await adminDb().collection(C.conversations).doc(id).collection(C.messages).orderBy("createdAt", "desc").limit(50).get();
  const initial = snap.docs.reverse().map((d) => ({ id: d.id, senderId: d.get("senderId") as string, text: d.get("text") as string, createdAt: d.get("createdAt")?.toMillis?.() ?? d.createTime.toMillis() }));
  const blocked = (await adminDb().collection(C.userBlocks).doc(`${u.uid}_${conv.otherUid}`).get()).exists;
  return (
    <div className="mx-auto flex h-[calc(100dvh-12rem)] max-w-3xl flex-col md:h-[calc(100dvh-9rem)]">
      <header className="flex items-center gap-3 border-b border-line pb-4">
        <Link href="/messages" className="grid size-9 place-items-center rounded-full hover:bg-white" aria-label={t("auth.back")}><ChevronLeft className="size-5" /></Link>
        <Avatar name={conv.otherName} size={40} />
        <div className="flex-1"><h1 className="font-semibold text-ink">{conv.otherName}</h1></div>
        {conv.bookingIds[0] && <Link href={`/bookings/${conv.bookingIds[0]}`} className="text-sm font-semibold text-trust">{t("nav.bookings")}</Link>}
      </header>
      <Thread convId={id} me={u.uid} otherUid={conv.otherUid} initial={initial} blocked={blocked} verified={u.verified} />
    </div>
  );
}
