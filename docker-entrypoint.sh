#!/bin/sh
set -e

echo "🔄 Running Prisma migrations..."
if ! node ./node_modules/prisma/build/index.js migrate deploy; then
  echo "❌ Prisma migrations failed"
  exit 1
fi
echo "✅ Prisma migrations completed successfully"

echo "🔄 Running Drizzle migrations..."

# Ensure pgcrypto is available for gen_random_uuid() defaults used by Drizzle tables
echo "🔑 Ensuring pgcrypto extension..."
node - <<'NODE'
const { Client } = require("pg");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = new Client({ connectionString });
  await client.connect();
  await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");
  await client.end();
}

main().catch((error) => {
  console.error("❌ Failed to ensure pgcrypto extension:", error);
  process.exit(1);
});
NODE
echo "✅ pgcrypto extension ensured"

# Run Drizzle migrations (do not rely on node_modules/.bin being present in Next standalone output)
if ! node ./node_modules/drizzle-kit/bin.cjs migrate --config=drizzle.config.ts; then
  echo "❌ Drizzle migrations failed"
  exit 1
fi

echo "✅ Drizzle migrations completed successfully"

# Start the application
echo "🚀 Starting application..."
exec node server.js
