#!/usr/bin/env bash
# Deploys HelpSmart to the staging Firebase project. Run from CI (.github/workflows/deploy-staging.yml)
# or locally with Application Default Credentials for the staging project.
#
#   STAGING_PROJECT_ID=<project-id> bash scripts/deploy-staging.sh
#
# What it does, in the order docs/DEPLOYMENT.md requires:
#   1. Finds (or creates) the staging web app and reads its public SDK config.
#   2. Creates the identity encryption and HMAC secrets once (random, never printed) and the web API key secret.
#   3. Creates the App Hosting backend once (source deploys, no GitHub link needed).
#   4. Deploys Firestore rules and indexes, Storage rules, then Cloud Functions.
#   5. Writes a staging-only apphosting.yaml into the CI workspace (not committed) and deploys the app.
#   6. Seeds reference data (categories, regions, settings). Never demo data.
#
# Identity stays IDENTITY_MODE=disabled on staging. The dev fixture is refused by the app outside
# development/test, and Fayda is not connected until NIDP onboarding issues real sandbox values.
set -euo pipefail

P="${STAGING_PROJECT_ID:?Set STAGING_PROJECT_ID}"
BACKEND="${STAGING_BACKEND_ID:-helpsmart-staging}"
REGION="${STAGING_APPHOSTING_REGION:-europe-west4}"
FB="npx --no-install firebase --non-interactive --project $P"

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
API_KEY="$(cfg apiKey)"; AUTH_DOMAIN="$(cfg authDomain)"; BUCKET="$(cfg storageBucket)"; SENDER="$(cfg messagingSenderId)"
echo "web app $APP_ID, bucket $BUCKET"

echo "== App Hosting backend"
if ! $FB apphosting:backends:get "$BACKEND" --json >/dev/null 2>&1; then
  $FB apphosting:backends:create --backend "$BACKEND" --primary-region "$REGION" --app "$APP_ID" --root-dir /
fi
URI="$($FB apphosting:backends:get "$BACKEND" --json | node -e 'const r=JSON.parse(require("fs").readFileSync(0)).result;const b=Array.isArray(r)?r[0]:r;console.log(b.uri)')"
BASE_URL="https://$URI"
echo "backend URL $BASE_URL"

echo "== Secrets"
ensure_secret() { # name, value-producing command
  local name="$1"; shift
  if gcloud secrets describe "$name" --project "$P" >/dev/null 2>&1; then
    echo "secret $name exists"
  else
    "$@" | $FB apphosting:secrets:set "$name" --data-file - --force >/dev/null
    echo "secret $name created"
  fi
  $FB apphosting:secrets:grantaccess "$name" --backend "$BACKEND" --location "$REGION" >/dev/null
}
rand32() { node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))"; }
ensure_secret helpsmart-identity-encryption-key rand32
ensure_secret helpsmart-identity-hmac-key rand32
ensure_secret helpsmart-web-api-key printf %s "$API_KEY"

echo "== Rules, indexes, functions"
$FB deploy --only firestore,storage
npm --prefix functions run build
$FB deploy --only functions --force

echo "== App"
# Staging values go into the CI workspace copy only. The committed apphosting.yaml keeps placeholders.
sed -i \
  -e "s#https://REPLACE_WITH_DOMAIN#$BASE_URL#g" \
  -e "s#REPLACE_WITH_PROJECT.appspot.com#$BUCKET#g" \
  -e "s#REPLACE_WITH_PROJECT.firebaseapp.com#$AUTH_DOMAIN#g" \
  -e "s#REPLACE_WITH_PROJECT#$P#g" \
  -e "s#REPLACE_WITH_APP_ID#$APP_ID#g" \
  -e "s#REPLACE_WITH_SENDER_ID#$SENDER#g" \
  apphosting.yaml
grep -q "value: staging" apphosting.yaml && grep -q "value: disabled" apphosting.yaml || { echo "apphosting.yaml must keep APP_ENV=staging and IDENTITY_MODE=disabled" >&2; exit 1; }
node -e '
  const fs=require("fs");const f=JSON.parse(fs.readFileSync("firebase.json"));
  f.apphosting=[{backendId:process.argv[1],rootDir:"/",alwaysDeployFromSource:true,
    ignore:["node_modules",".git",".next","functions","tests","firebase-debug.log","firebase-debug.*.log"]}];
  fs.writeFileSync("firebase.json",JSON.stringify(f,null,2));' "$BACKEND"
$FB deploy --only apphosting

echo "== Reference data"
GCLOUD_PROJECT="$P" npm run seed -- --project

echo
echo "Staging is live at $BASE_URL"
[ -n "${GITHUB_STEP_SUMMARY:-}" ] && echo "Staging deployed: $BASE_URL" >> "$GITHUB_STEP_SUMMARY"
