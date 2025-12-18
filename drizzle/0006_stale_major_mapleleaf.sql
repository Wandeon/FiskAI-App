CREATE TABLE IF NOT EXISTS "checklist_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"item_type" varchar(50) NOT NULL,
	"item_reference" varchar(100) NOT NULL,
	"action" varchar(20) NOT NULL,
	"snoozed_until" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_guidance_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"level_fakturiranje" varchar(20) DEFAULT 'beginner' NOT NULL,
	"level_financije" varchar(20) DEFAULT 'beginner' NOT NULL,
	"level_eu" varchar(20) DEFAULT 'beginner' NOT NULL,
	"global_level" varchar(20),
	"email_digest" varchar(20) DEFAULT 'weekly',
	"push_enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "news_categories" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name_hr" varchar(200) NOT NULL,
	"parent_id" varchar(50),
	"icon" varchar(50),
	"color" varchar(20),
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "news_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "news_post_sources" (
	"post_id" uuid NOT NULL,
	"news_item_id" uuid NOT NULL,
	CONSTRAINT "news_post_sources_post_id_news_item_id_pk" PRIMARY KEY("post_id","news_item_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "news_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(300) NOT NULL,
	"type" varchar(20) NOT NULL,
	"title" varchar(500) NOT NULL,
	"content" text NOT NULL,
	"excerpt" varchar(500),
	"featured_image_url" varchar(1000),
	"featured_image_source" varchar(200),
	"featured_image_caption" varchar(500),
	"category_id" varchar(50),
	"tags" jsonb DEFAULT '[]'::jsonb,
	"impact_level" varchar(20),
	"ai_passes" jsonb DEFAULT '{}'::jsonb,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "news_posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "news_tags" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name_hr" varchar(200) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "news_tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "newsletter_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"source" varchar(100) DEFAULT 'vijesti_sidebar',
	"confirmed_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "newsletter_subscriptions_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "eu_transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"bank_transaction_id" uuid,
	"direction" varchar(20) NOT NULL,
	"counterparty_name" varchar(255),
	"counterparty_country" varchar(2),
	"counterparty_vat_id" varchar(20),
	"transaction_date" date NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR',
	"pdv_rate" numeric(4, 2) DEFAULT '25.00',
	"pdv_amount" numeric(10, 2),
	"reporting_month" integer NOT NULL,
	"reporting_year" integer NOT NULL,
	"vendor_id" uuid,
	"detection_method" varchar(20),
	"confidence_score" integer,
	"user_confirmed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "eu_vendor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_pattern" varchar(255) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"vendor_type" varchar(50) NOT NULL,
	"is_eu" boolean DEFAULT true,
	"confidence_score" integer DEFAULT 100,
	"is_system" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "generated_form" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"form_type" varchar(20) NOT NULL,
	"period_month" integer,
	"period_year" integer NOT NULL,
	"format" varchar(10) NOT NULL,
	"file_path" varchar(500),
	"file_hash" varchar(64),
	"form_data" jsonb,
	"submitted_to_porezna" boolean DEFAULT false,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_preference" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" varchar(20) NOT NULL,
	"enabled" boolean DEFAULT true,
	"remind_7_days" boolean DEFAULT true,
	"remind_3_days" boolean DEFAULT true,
	"remind_1_day" boolean DEFAULT true,
	"remind_day_of" boolean DEFAULT true,
	"google_calendar_connected" boolean DEFAULT false,
	"google_calendar_id" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pausalni_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"has_pdv_id" boolean DEFAULT false,
	"pdv_id" varchar(20),
	"pdv_id_since" date,
	"eu_active" boolean DEFAULT false,
	"hok_member_since" date,
	"tourism_activity" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_obligation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"obligation_type" varchar(50) NOT NULL,
	"period_month" integer NOT NULL,
	"period_year" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"due_date" date NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"paid_date" date,
	"paid_amount" numeric(10, 2),
	"matched_transaction_id" uuid,
	"match_type" varchar(20),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DROP INDEX "idx_news_items_processed";--> statement-breakpoint
DROP INDEX "idx_news_items_url";--> statement-breakpoint
ALTER TABLE "news_items" ALTER COLUMN "relevance_score" SET DATA TYPE varchar(10);--> statement-breakpoint
ALTER TABLE "news_sources" ALTER COLUMN "scrape_selector" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "news_items" ADD COLUMN "source_url" varchar(1000) NOT NULL;--> statement-breakpoint
ALTER TABLE "news_items" ADD COLUMN "original_title" varchar(500) NOT NULL;--> statement-breakpoint
ALTER TABLE "news_items" ADD COLUMN "original_content" text;--> statement-breakpoint
ALTER TABLE "news_items" ADD COLUMN "fetched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "news_items" ADD COLUMN "summary_en" text;--> statement-breakpoint
ALTER TABLE "news_items" ADD COLUMN "impact_level" varchar(20);--> statement-breakpoint
ALTER TABLE "news_items" ADD COLUMN "assigned_to_post_id" uuid;--> statement-breakpoint
ALTER TABLE "news_items" ADD COLUMN "image_url" varchar(1000);--> statement-breakpoint
ALTER TABLE "news_items" ADD COLUMN "image_source" varchar(200);--> statement-breakpoint
ALTER TABLE "news_items" ADD COLUMN "status" varchar(20) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "news_categories" ADD CONSTRAINT "news_categories_parent_id_news_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."news_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_post_sources" ADD CONSTRAINT "news_post_sources_post_id_news_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."news_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_post_sources" ADD CONSTRAINT "news_post_sources_news_item_id_news_items_id_fk" FOREIGN KEY ("news_item_id") REFERENCES "public"."news_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_posts" ADD CONSTRAINT "news_posts_category_id_news_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."news_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checklist_interactions_user_company_idx" ON "checklist_interactions" USING btree ("user_id","company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checklist_interactions_reference_idx" ON "checklist_interactions" USING btree ("item_reference");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_guidance_preferences_user_idx" ON "user_guidance_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_news_categories_slug" ON "news_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_news_categories_parent" ON "news_categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_news_post_sources_post" ON "news_post_sources" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_news_post_sources_item" ON "news_post_sources" USING btree ("news_item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_news_posts_slug" ON "news_posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_news_posts_status" ON "news_posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_news_posts_published" ON "news_posts" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_news_posts_category" ON "news_posts" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_news_posts_type" ON "news_posts" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_news_posts_impact" ON "news_posts" USING btree ("impact_level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_news_tags_slug" ON "news_tags" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_newsletter_email" ON "newsletter_subscriptions" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_newsletter_active" ON "newsletter_subscriptions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eu_transaction_reporting_idx" ON "eu_transaction" USING btree ("company_id","reporting_year","reporting_month");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eu_vendor_pattern_idx" ON "eu_vendor" USING btree ("name_pattern");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pausalni_profile_company_idx" ON "pausalni_profile" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_obligation_company_status_idx" ON "payment_obligation" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_obligation_due_date_idx" ON "payment_obligation" USING btree ("due_date");--> statement-breakpoint
ALTER TABLE "news_items" ADD CONSTRAINT "news_items_assigned_to_post_id_news_posts_id_fk" FOREIGN KEY ("assigned_to_post_id") REFERENCES "public"."news_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_news_items_status" ON "news_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_news_items_impact" ON "news_items" USING btree ("impact_level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_news_items_assigned" ON "news_items" USING btree ("assigned_to_post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_news_items_url" ON "news_items" USING btree ("source_url");--> statement-breakpoint
ALTER TABLE "news_items" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "news_items" DROP COLUMN "content";--> statement-breakpoint
ALTER TABLE "news_items" DROP COLUMN "url";--> statement-breakpoint
ALTER TABLE "news_items" DROP COLUMN "processed";--> statement-breakpoint
ALTER TABLE "news_sources" DROP COLUMN "last_success_at";--> statement-breakpoint
ALTER TABLE "news_sources" DROP COLUMN "last_error";