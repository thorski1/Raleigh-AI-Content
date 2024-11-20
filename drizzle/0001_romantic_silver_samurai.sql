CREATE TYPE "public"."content_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
ALTER TABLE "content" ALTER COLUMN "status" SET DATA TYPE content_status;