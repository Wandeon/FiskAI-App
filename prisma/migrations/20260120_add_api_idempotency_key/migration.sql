-- CreateEnum
CREATE TYPE "ApiIdempotencyRoute" AS ENUM ('APPROVE_RULES', 'PUBLISH_RULES');

-- CreateTable
CREATE TABLE "ApiIdempotencyKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "route" "ApiIdempotencyRoute" NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "requestMeta" JSONB,
    "responseSummary" JSONB,

    CONSTRAINT "ApiIdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiIdempotencyKey_expiresAt_idx" ON "ApiIdempotencyKey"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiIdempotencyKey_route_key_key" ON "ApiIdempotencyKey"("route", "key");
