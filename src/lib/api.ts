"use client";

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

/** Typed JSON client for HelpSmart's /api routes. Retries once on network failure (low-bandwidth friendly). */
export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const init: RequestInit = {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers: opts.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: "same-origin",
  };
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    await new Promise((r) => setTimeout(r, 800));
    try {
      res = await fetch(path, init);
    } catch {
      throw new ApiClientError(0, "network", "You appear to be offline. Check your connection and try again.");
    }
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = json.error ?? {};
    throw new ApiClientError(res.status, e.code ?? "error", e.message ?? "Something went wrong", e.fields);
  }
  return json.data as T;
}
