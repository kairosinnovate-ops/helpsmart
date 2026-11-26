// Upserts Netlify site environment variables (production context) through the Netlify REST API.
// Reads a JSON object {KEY: {value, secret}} from stdin so values never appear on a command line or in logs.
// Usage: node scripts/netlify-env.mjs < vars.json   (needs NETLIFY_AUTH_TOKEN, NETLIFY_SITE_ID, NETLIFY_TEAM_SLUG)
// With --missing-only, keys that already exist are left unchanged.
import { readFileSync } from "node:fs";

const token = process.env.NETLIFY_AUTH_TOKEN;
const site = process.env.NETLIFY_SITE_ID;
const account = process.env.NETLIFY_TEAM_SLUG || "kairos-innovate";
if (!token || !site) throw new Error("NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID are required");
const missingOnly = process.argv.includes("--missing-only");
const vars = JSON.parse(readFileSync(0, "utf8"));
const base = `https://api.netlify.com/api/v1/accounts/${account}/env`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

for (const [key, { value, secret = false }] of Object.entries(vars)) {
  const body = { key, scopes: secret ? ["builds", "functions", "runtime"] : ["builds", "functions", "runtime", "post_processing"], is_secret: secret, values: [{ context: "production", value: String(value) }] };
  const existing = await fetch(`${base}/${key}?site_id=${site}`, { headers });
  if (existing.ok && missingOnly) { console.log(`${key} exists`); continue; }
  const res = existing.ok
    ? await fetch(`${base}/${key}?site_id=${site}`, { method: "PUT", headers, body: JSON.stringify(body) })
    : await fetch(`${base}?site_id=${site}`, { method: "POST", headers, body: JSON.stringify([body]) });
  // Never print values or response bodies, which may echo them.
  if (!res.ok) throw new Error(`Setting ${key} failed with HTTP ${res.status}`);
  console.log(`set ${key}${secret ? " (secret)" : ""}`);
}
