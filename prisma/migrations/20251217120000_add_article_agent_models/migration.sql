-- CreateEnum
CREATE TYPE "ArticleType" AS ENUM ('NEWS', 'GUIDE', 'HOWTO', 'GLOSSARY', 'COMPARISON');

-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('SYNTHESIZING', 'PLANNING', 'DRAFTING', 'VERIFYING', 'NEEDS_REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED');

-- DropForeignKey
ALTER TABLE "news_categories" DROP CONSTRAINT "news_categories_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "news_items" DROP CONSTRAINT "news_items_assigned_to_post_id_fkey";

-- DropForeignKey
ALTER TABLE "news_items" DROP CONSTRAINT "news_items_source_id_news_sources_id_fk";

-- DropForeignKey
ALTER TABLE "news_post_sources" DROP CONSTRAINT "news_post_sources_news_item_id_fkey";

-- DropForeignKey
ALTER TABLE "news_post_sources" DROP CONSTRAINT "news_post_sources_post_id_fkey";

-- DropForeignKey
ALTER TABLE "news_posts" DROP CONSTRAINT "news_posts_category_id_fkey";

-- DropTable
DROP TABLE "compliance_deadlines";

-- DropTable
DROP TABLE "news_categories";

-- DropTable
DROP TABLE "news_items";

-- DropTable
DROP TABLE "news_post_sources";

-- DropTable
DROP TABLE "news_posts";

-- DropTable
DROP TABLE "news_sources";

-- DropTable
DROP TABLE "news_tags";

-- CreateTable
CREATE TABLE "ArticleJob" (
    "id" TEXT NOT NULL,
    "type" "ArticleType" NOT NULL,
    "status" "ArticleStatus" NOT NULL DEFAULT 'SYNTHESIZING',
    "sourceUrls" TEXT[],
    "topic" TEXT,
    "currentIteration" INTEGER NOT NULL DEFAULT 0,
    "maxIterations" INTEGER NOT NULL DEFAULT 3,
    "factSheetId" TEXT,
    "finalContentMdx" TEXT,
    "finalSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "ArticleJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactSheet" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "keyEntities" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "factSheetId" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "quote" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "sourceChunkId" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "category" TEXT,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceChunk" (
    "id" TEXT NOT NULL,
    "factSheetId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleDraft" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "iteration" INTEGER NOT NULL,
    "contentMdx" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftParagraph" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION,
    "supportingClaimIds" TEXT[],

    CONSTRAINT "DraftParagraph_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimVerification" (
    "id" TEXT NOT NULL,
    "paragraphId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "similarityScore" DOUBLE PRECISION NOT NULL,
    "isSupporting" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArticleJob_factSheetId_key" ON "ArticleJob"("factSheetId");

-- CreateIndex
CREATE INDEX "ArticleJob_status_idx" ON "ArticleJob"("status");

-- CreateIndex
CREATE INDEX "ArticleJob_type_idx" ON "ArticleJob"("type");

-- CreateIndex
CREATE UNIQUE INDEX "FactSheet_jobId_key" ON "FactSheet"("jobId");

-- CreateIndex
CREATE INDEX "Claim_factSheetId_idx" ON "Claim"("factSheetId");

-- CreateIndex
CREATE INDEX "SourceChunk_factSheetId_idx" ON "SourceChunk"("factSheetId");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleDraft_jobId_iteration_key" ON "ArticleDraft"("jobId", "iteration");

-- CreateIndex
CREATE UNIQUE INDEX "DraftParagraph_draftId_index_key" ON "DraftParagraph"("draftId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "ClaimVerification_paragraphId_claimId_key" ON "ClaimVerification"("paragraphId", "claimId");

-- AddForeignKey
ALTER TABLE "FactSheet" ADD CONSTRAINT "FactSheet_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ArticleJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_factSheetId_fkey" FOREIGN KEY ("factSheetId") REFERENCES "FactSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_sourceChunkId_fkey" FOREIGN KEY ("sourceChunkId") REFERENCES "SourceChunk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceChunk" ADD CONSTRAINT "SourceChunk_factSheetId_fkey" FOREIGN KEY ("factSheetId") REFERENCES "FactSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleDraft" ADD CONSTRAINT "ArticleDraft_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ArticleJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftParagraph" ADD CONSTRAINT "DraftParagraph_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ArticleDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimVerification" ADD CONSTRAINT "ClaimVerification_paragraphId_fkey" FOREIGN KEY ("paragraphId") REFERENCES "DraftParagraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimVerification" ADD CONSTRAINT "ClaimVerification_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

