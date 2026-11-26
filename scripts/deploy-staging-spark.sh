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
setv() { $NL env:set "$1" "$2" --context production --force >/dev/null; echo "set $1"; }
sets() { $NL env:set "$1" "$2" --context production --secret --force >/dev/null; echo "set $1 (secret)"; }
setv APP_ENV staging
setv IDENTITY_MODE disabled
setv APP_BASE_URL "$SITE_URL"
setv GCLOUD_PROJECT "$P"
setv NEXT_PUBLIC_UPLOADS_ENABLED false
setv NEXT_PUBLIC_FIREBASE_API_KEY "$(cfg apiKey)"
setv NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN "$(cfg authDomain)"
setv NEXT_PUBLIC_FIREBASE_PROJECT_ID "$P"
setv NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET "$(cfg storageBucket)"
setv NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID "$(cfg messagingSenderId)"
setv NEXT_PUBLIC_FIREBASE_APP_ID "$APP_ID"
sets FIREBASE_CLIENT_EMAIL "$(node -e 'console.log(require(process.argv[1]).client_email)' "$KEY_FILE")"
sets FIREBASE_PRIVATE_KEY "$(node -e 'process.stdout.write(require(process.argv[1]).private_key.replace(/\n/g,"\\n"))' "$KEY_FILE")"
# Identity encryption keys: generated once, kept only in Netlify's secret store, never printed.
for k in IDENTITY_ENCRYPTION_KEY IDENTITY_HMAC_KEY; do
  if ! $NL api getEnvVar --data "{\"account_id\":\"${NETLIFY_TEAM_SLUG:-kairos-innovate}\",\"site_id\":\"$NETLIFY_SITE_ID\",\"key\":\"$k\"}" >/dev/null 2>&1; then
    sets "$k" "$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))")"
  else
    echo "$k exists"
  fi
done

echo "== Build and deploy app"
$NL deploy --build --prod --site "$NETLIFY_SITE_ID" --message "staging $(git rev-parse --short HEAD)"

echo
echo "Staging is live at $SITE_URL"
[ -n "${GITHUB_STEP_SUMMARY:-}" ] && echo "Staging deployed: $SITE_URL" >> "$GITHUB_STEP_SUMMARY"
