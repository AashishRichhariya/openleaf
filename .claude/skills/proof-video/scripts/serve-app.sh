#!/bin/bash
# Builds openleaf from /work and serves it on 127.0.0.1:4200, against DynamoDB Local on 127.0.0.1:8000.
# Only local settings are passed: no env file exists in /work (run.sh checks).
set -euo pipefail
cd /work
export AWS_ENDPOINT_URL=http://127.0.0.1:8000 AWS_ENDPOINT_URL_DYNAMODB=http://127.0.0.1:8000 \
  AWS_REGION=ap-south-1 AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local AWS_SESSION_TOKEN= \
  AWS_PROFILE= AWS_CONFIG_FILE=/dev/null AWS_SHARED_CREDENTIALS_FILE=/dev/null \
  DOCUMENTS_TABLE=openleaf-local-proof NEXT_PUBLIC_UMAMI_WEBSITE_ID= NEXT_PUBLIC_UMAMI_SCRIPT_URL= \
  NEXT_TELEMETRY_DISABLED=1 CI=1
LOGS=${LOGS:-/out/.work}
pnpm config set store-dir /pnpm-store >/dev/null
echo "app: installing"
pnpm install --frozen-lockfile >"$LOGS/app-install.log" 2>&1
node -e '
const { DynamoDBClient, CreateTableCommand } = require("@aws-sdk/client-dynamodb");
const db = new DynamoDBClient({});
const table = new CreateTableCommand({
  TableName: process.env.DOCUMENTS_TABLE, BillingMode: "PAY_PER_REQUEST",
  AttributeDefinitions: [{ AttributeName: "slug", AttributeType: "S" }, { AttributeName: "version", AttributeType: "N" }],
  KeySchema: [{ AttributeName: "slug", KeyType: "HASH" }, { AttributeName: "version", KeyType: "RANGE" }],
});
(async () => {
  for (let i = 1; ; i++) {
    try { await db.send(table); return; } catch (e) {
      if (e.name === "ResourceInUseException") return;
      if (i === 30) throw e;
      await new Promise((done) => setTimeout(done, 1000));
    }
  }
})().catch((e) => { console.error(e); process.exit(1); });'
mkdir -p .next /next-cache && ln -sfn /next-cache .next/cache
echo "app: building"
pnpm build >"$LOGS/app-build.log" 2>&1 || { tail -30 "$LOGS/app-build.log"; exit 1; }
pnpm start -H 127.0.0.1 -p 4200 >"$LOGS/app.log" 2>&1 &
for _ in $(seq 1 60); do
  curl -fs -o /dev/null http://127.0.0.1:4200/ && { echo "app: ready on 127.0.0.1:4200"; exit 0; }
  sleep 1
done
tail -30 "$LOGS/app.log"
exit 1
