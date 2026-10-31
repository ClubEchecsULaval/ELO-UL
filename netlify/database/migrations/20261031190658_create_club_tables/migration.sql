CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" integer,
	"details" jsonb
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY,
	"slug" text NOT NULL UNIQUE,
	"title" text NOT NULL,
	"type" text DEFAULT 'soiree' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"location" text,
	"summary" text,
	"description" text,
	"rules" text,
	"time_control" text,
	"rounds" integer,
	"capacity" integer,
	"fee" text,
	"registration_open" boolean DEFAULT false NOT NULL,
	"registration_deadline" timestamp with time zone,
	"rated" boolean DEFAULT true NOT NULL,
	"cancelled" boolean DEFAULT false NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" serial PRIMARY KEY,
	"played_at" timestamp with time zone NOT NULL,
	"white_id" integer NOT NULL,
	"black_id" integer NOT NULL,
	"result" text NOT NULL,
	"event_id" integer,
	"round" integer,
	"rated" boolean DEFAULT true NOT NULL,
	"time_control" text,
	"notes" text,
	"pgn" text,
	"white_rating_before" integer,
	"white_rating_after" integer,
	"black_rating_before" integer,
	"black_rating_after" integer,
	"white_k" integer,
	"black_k" integer,
	"expected_white" real,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"handled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news" (
	"id" serial PRIMARY KEY,
	"slug" text NOT NULL UNIQUE,
	"title" text NOT NULL,
	"category" text DEFAULT 'annonce' NOT NULL,
	"excerpt" text,
	"body" text DEFAULT '' NOT NULL,
	"author" text,
	"published" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" serial PRIMARY KEY,
	"slug" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"status" text DEFAULT 'membre' NOT NULL,
	"program" text,
	"bio" text,
	"fide_id" text,
	"cfc_id" text,
	"rating" integer DEFAULT 1200 NOT NULL,
	"peak_rating" integer DEFAULT 1200 NOT NULL,
	"games_count" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"draws" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"last_played_at" timestamp with time zone,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registrations" (
	"id" serial PRIMARY KEY,
	"event_id" integer NOT NULL,
	"player_id" integer,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"affiliation" text DEFAULT 'etudiant' NOT NULL,
	"rating_estimate" integer,
	"message" text,
	"status" text DEFAULT 'en_attente' NOT NULL,
	"show_publicly" boolean DEFAULT false NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "events_starts_at_idx" ON "events" ("starts_at");--> statement-breakpoint
CREATE INDEX "games_played_at_idx" ON "games" ("played_at");--> statement-breakpoint
CREATE INDEX "games_white_idx" ON "games" ("white_id");--> statement-breakpoint
CREATE INDEX "games_black_idx" ON "games" ("black_id");--> statement-breakpoint
CREATE INDEX "games_event_idx" ON "games" ("event_id");--> statement-breakpoint
CREATE INDEX "news_published_at_idx" ON "news" ("published_at");--> statement-breakpoint
CREATE INDEX "players_rating_idx" ON "players" ("rating");--> statement-breakpoint
CREATE INDEX "registrations_event_idx" ON "registrations" ("event_id");--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_white_id_players_id_fkey" FOREIGN KEY ("white_id") REFERENCES "players"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_black_id_players_id_fkey" FOREIGN KEY ("black_id") REFERENCES "players"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_player_id_players_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE SET NULL;