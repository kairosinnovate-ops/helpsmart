"use client";
import { useState } from "react";
import { getDownloadURL, ref } from "firebase/storage";
import { firebase } from "@/lib/firebase/client";

/** Opens a credential file via Storage rules (verification officers only). Never cached offline. */
export function CredentialLink({ path }: { path: string }) {
  const [err, setErr] = useState(false);
  return (
    <button type="button" className="font-semibold text-trust" onClick={async () => {
      try { window.open(await getDownloadURL(ref(firebase().storage, path)), "_blank", "noopener"); } catch { setErr(true); }
    }}>{err ? "Unavailable" : "Open"}</button>
  );
}
