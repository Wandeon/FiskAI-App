-- AlterEnum: Add RSS_FEED to ListingStrategy
-- Migration for GitHub Issue #155: EUR-Lex Dynamic Discovery

ALTER TYPE "ListingStrategy" ADD VALUE 'RSS_FEED';
