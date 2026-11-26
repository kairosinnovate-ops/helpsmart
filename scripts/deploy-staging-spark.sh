#!/usr/bin/env bash
# Reduced staging: Firebase Spark plan (Auth + Firestore) with the Next.js app on Netlify.
# Spark has no Cloud Functions, App Hosting, Secret Manager or new Storage buckets, so on this staging:
#   - credential uploads are hidden (NEXT_PUBLIC_UPLOADS_ENABLED=false) and the banner says so
#   - push notifications and the hourly cleanup function do not run (in-app notifications still work)
# For the full setup on Blaze, use scripts/deploy-staging.sh instead.
#
#   STAGING_PROJECT_ID=<id> NETLIFY_AUTH_TOKEN=<token> NETLIFY_SITE_ID=<id> \
#   GOOGLE_APPLICATION_CREDENTIALS=<key.json> bash scripts/deploy-staging-spark.sh
set -euo pipefail

P="${STAGING_PROJECT_ID:?Set STAGING_PROJECT_ID}"
: "${NETLIFY_AUTH_TOKEN:?Set NETLIFY_AUTH_TOKEN}" "${NETLIFY_SITE_ID:?Set NETLIFY_SITE_ID}"
KEY_FILE="${GOOGLE_APPLICATION_CREDENTIALS:?Set GOOGLE_APPLICATION_CREDENTIALS to the service account key}"
FB="npx --no-install firebase --non-interactive --project $P"
NL="npx -y netlify-cli@23.11.0"

case "$P" in
  *prod*|*production*) echo "Refusing: '$P' looks like a production project." >&2; exit 1 ;;
esac

echo "== Web app config"
APP_ID="$($FB apps:list WEB --json | node -e 'const r=JSON.parse(require("fs").readFileSync(0)).result||[];const a=r.find(x=>x.displayName==="helpsmart-staging-web")||r[0];if(a)console.log(a.appId)')"
if [ -z "$APP_ID" ]; then
  $FB apps:create WEB helpsmart-staging-web >/dev/null
  APP_ID="$($FB apps:list WEB --json | node -e 'console.log(JSON.parse(require("fs").readFileSync(0)).result[0].appId)')"
fi
SDK="$($FB apps:sdkconfig WEB "$APP_ID" --json)"
cfg() { node -e "const r=JSON.parse(process.argv[1]).result;const c=r.sdkConfig||r.fileContents&&JSON.parse(r.fileContents)||r;console.log(c[process.argv[2]]||'')" "$SDK" "$1"; }

echo "== Firestore rules and indexes"
# TTL policies need billing, so Spark skips them (CI workspace copy only). Expired rate-limit and
# identity-session documents then stay in the database; the app already checks expiresAt when reading them.
node -e '
  const fs=require("fs");const f=JSON.parse(fs.readFileSync("firestore.indexes.json"));
  f.fieldOverrides=(f.fieldOverrides||[]).filter(o=>!o.ttl);
  fs.writeFileSync("firestore.indexes.json",JSON.stringify(f,null,2));'
$FB deploy --only firestore

echo "== Reference data"
GCLOUD_PROJECT="$P" npm run seed -- --project

echo "== Netlify environment"
SITE_URL="$($NL api getSite --data "{\"site_id\":\"$NETLIFY_SITE_ID\"}" | node -e 'const s=JSON.parse(require("fs").readFileSync(0));console.log(s.ssl_url||s.url)')"
# Values go to Netlify through stdin (scripts/netlify-env.mjs), never as command-line arguments, so they can't
# show up in CI logs or error messages.
export APP_ID P SITE_URL KEY_FILE SDK
node -e '
  const r=JSON.parse(process.env.SDK).result;const c=r.sdkConfig||(r.fileContents&&JSON.parse(r.fileContents))||r;
  const k=JSON.parse(require("fs").readFileSync(process.env.KEY_FILE,"utf8"));
  const v=(value,secret=false)=>({value,secret});
  process.stdout.write(JSON.stringify({
    APP_ENV:v("staging"),IDENTITY_MODE:v("disabled"),APP_BASE_URL:v(process.env.SITE_URL),GCLOUD_PROJECT:v(process.env.P),
    NEXT_PUBLIC_UPLOADS_ENABLED:v("false"),NEXT_PUBLIC_FIREBASE_API_KEY:v(c.apiKey),NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:v(c.authDomain),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID:v(process.env.P),NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:v(c.storageBucket||""),
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:v(c.messagingSenderId||""),NEXT_PUBLIC_FIREBASE_APP_ID:v(process.env.APP_ID),
    FIREBASE_CLIENT_EMAIL:v(k.client_email,true),FIREBASE_PRIVATE_KEY:v(k.private_key.replace(/\n/g,"\\n"),true)}));' \
  | node scripts/netlify-env.mjs
# Identity encryption keys: generated once, kept only in Netlify's secret store, never printed.
node -e '
  const g=()=>({value:require("crypto").randomBytes(32).toString("base64"),secret:true});
  process.stdout.write(JSON.stringify({IDENTITY_ENCRYPTION_KEY:g(),IDENTITY_HMAC_KEY:g()}));' \
  | node scripts/netlify-env.mjs --missing-only

echo "== Build and deploy app"
$NL deploy --build --prod --site "$NETLIFY_SITE_ID" --message "staging $(git rev-parse --short HEAD)"

echo
echo "Staging is live at $SITE_URL"
[ -n "${GITHUB_STEP_SUMMARY:-}" ] && echo "Staging deployed: $SITE_URL" >> "$GITHUB_STEP_SUMMARY"
