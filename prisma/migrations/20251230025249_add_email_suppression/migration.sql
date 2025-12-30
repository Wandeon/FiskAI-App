-- CreateTable
CREATE TABLE "EmailSuppression" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "suppressedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSuppression_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailSuppression_email_key" ON "EmailSuppression"("email");
CREATE INDEX "EmailSuppression_email_idx" ON "EmailSuppression"("email");
CREATE INDEX "EmailSuppression_suppressedAt_idx" ON "EmailSuppression"("suppressedAt");
CREATE INDEX "EmailSuppression_expiresAt_idx" ON "EmailSuppression"("expiresAt");
