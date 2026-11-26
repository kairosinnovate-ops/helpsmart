"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, limitToLast, onSnapshot, orderBy, query } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Send, ShieldAlert } from "lucide-react";
import clsx from "clsx";
import { firebase } from "@/lib/firebase/client";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n/client";
import { formatDate } from "@/lib/i18n/core";
import { useAction } from "@/lib/use-action";
import { Alert, Button } from "@/components/ui";

interface Msg { id: string; senderId: string; text: string; createdAt: number }

export function Thread({ convId, me, otherUid, initial, blocked, verified }: { convId: string; me: string; otherUid: string; initial: Msg[]; blocked: boolean; verified: boolean }) {
  const { t, locale } = useT();
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [text, setText] = useState("");
  const { run, busy, error } = useAction();
  const endRef = useRef<HTMLDivElement>(null);

  // Realtime via Firestore (rules restrict reads to participants). Falls back to polling.
  useEffect(() => {
    const { auth, db } = firebase();
    let unsub: (() => void) | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    const stopAuth = onAuthStateChanged(auth, (user) => {
      unsub?.();
      if (!user || user.uid !== me) {
        poll ??= setInterval(() => router.refresh(), 10000);
        return;
      }
      const q = query(collection(db, "conversations", convId, "messages"), orderBy("createdAt", "asc"), limitToLast(100));
      unsub = onSnapshot(
        q,
        (s) => setMsgs(s.docs.map((d) => ({ id: d.id, senderId: d.get("senderId"), text: d.get("text"), createdAt: d.get("createdAt")?.toMillis?.() ?? Date.now() }))),
        () => { poll ??= setInterval(() => router.refresh(), 10000); },
      );
    });
    void api(`/api/v1/conversations/${convId}/read`, { body: {} }).catch(() => undefined);
    return () => { stopAuth(); unsub?.(); if (poll) clearInterval(poll); };
  }, [convId, me, router]);

  // When the server sends a fresher list (polling fallback), adopt it during render rather than in an effect.
  const [seenInitial, setSeenInitial] = useState(initial);
  if (seenInitial !== initial) {
    setSeenInitial(initial);
    if (initial.length > msgs.length) setMsgs(initial);
  }
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  return (
    <>
      <div className="flex-1 space-y-2 overflow-y-auto py-4" aria-live="polite">
        <p className="mx-auto mb-4 flex max-w-md items-start gap-2 rounded-xl bg-warning-50 p-3 text-xs text-warning"><ShieldAlert className="size-4 shrink-0" /> {t("messages.safety")}</p>
        {msgs.map((m) => (
          <div key={m.id} className={clsx("flex", m.senderId === me ? "justify-end" : "justify-start")}>
            <div className={clsx("max-w-[80%] rounded-2xl px-4 py-2.5", m.senderId === me ? "rounded-br-md bg-trust text-white" : "rounded-bl-md border border-line bg-white text-ink")}>
              <p className="whitespace-pre-line break-words text-[15px]">{m.text}</p>
              <p className={clsx("mt-1 text-[11px]", m.senderId === me ? "text-white/60" : "text-muted")}>{formatDate(m.createdAt, locale, { timeStyle: "short" })}</p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {error && <Alert tone="danger" className="mb-2">{error}</Alert>}
      {blocked ? (
        <div className="flex items-center justify-between rounded-2xl border border-line bg-white p-3 text-sm"><span className="text-muted">Blocked</span><Button size="sm" variant="secondary" onClick={() => run("/api/v1/blocks", { otherUid, block: false })}>{t("messages.unblock")}</Button></div>
      ) : (
        <form
          className="flex items-end gap-2 border-t border-line pt-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!text.trim()) return;
            const body = text;
            setText("");
            const r = await run(`/api/v1/conversations/${convId}/messages`, { text: body }, { refresh: false });
            if (!r) setText(body);
          }}
        >
          <label htmlFor="msg" className="sr-only">{t("messages.placeholder")}</label>
          <textarea id="msg" rows={1} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder={t("messages.placeholder")} disabled={!verified} className="max-h-32 min-h-12 flex-1 resize-none rounded-2xl border border-line bg-white px-4 py-3 text-[15px] focus:border-trust focus:outline-none" />
          <Button type="submit" loading={busy} disabled={!verified || !text.trim()} aria-label={t("messages.send")}><Send className="size-4" /></Button>
        </form>
      )}
      <div className="mt-2 flex justify-end gap-4 text-xs">
        {!blocked && <button type="button" className="font-medium text-muted hover:text-danger" onClick={() => run("/api/v1/blocks", { otherUid, block: true })}>{t("messages.block")}</button>}
        <button type="button" className="font-medium text-muted hover:text-danger" onClick={() => run("/api/v1/reports", { type: "message", subjectId: otherUid, description: `Reported from conversation ${convId}` }, { refresh: false })}>{t("messages.report")}</button>
      </div>
    </>
  );
}
