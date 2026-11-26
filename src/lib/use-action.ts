"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "./api";

/** Small helper for buttons/forms that call the API, then refresh server components. */
export function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const run = useCallback(
    async <T,>(path: string, body?: unknown, opts: { method?: string; refresh?: boolean; onSuccess?: (data: T) => void } = {}) => {
      setBusy(true);
      setError(null);
      setFieldErrors({});
      try {
        const data = await api<T>(path, { method: opts.method, body: body ?? {} });
        opts.onSuccess?.(data);
        if (opts.refresh !== false) router.refresh();
        return data;
      } catch (e) {
        if (e instanceof ApiClientError) {
          setError(e.message);
          if (e.fields) setFieldErrors(Object.fromEntries(e.fields.map((f) => [f.path, f.message])));
        } else setError("Something went wrong");
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [router],
  );
  return { run, busy, error, fieldErrors, setError };
}
