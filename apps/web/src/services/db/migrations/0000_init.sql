CREATE TABLE `articles` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text,
	`title` text DEFAULT '' NOT NULL,
	`raw_text` text NOT NULL,
	`language` text NOT NULL,
	`added_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lookups` (
	`id` text PRIMARY KEY NOT NULL,
	`timestamp` integer NOT NULL,
	`source_text` text NOT NULL,
	`source_lang` text NOT NULL,
	`translation` text NOT NULL,
	`context` text DEFAULT '' NOT NULL,
	`article_id` text,
	`provider` text NOT NULL,
	`prompt_id` text,
	`tier` text NOT NULL,
	`raw_response` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `lookups_timestamp_idx` ON `lookups` (`timestamp`);--> statement-breakpoint
CREATE TABLE `prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`language` text NOT NULL,
	`name` text NOT NULL,
	`system_prompt` text NOT NULL,
	`built_in` integer DEFAULT false NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vocab_items` (
	`id` text PRIMARY KEY NOT NULL,
	`lemma` text NOT NULL,
	`language` text NOT NULL,
	`first_seen_at` integer NOT NULL,
	`lookup_count` integer DEFAULT 0 NOT NULL,
	`last_seen_at` integer NOT NULL,
	`user_notes` text DEFAULT '' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`exported_to_anki` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vocab_lemma_lang_uniq` ON `vocab_items` (`lemma`,`language`);--> statement-breakpoint
CREATE INDEX `vocab_exported_idx` ON `vocab_items` (`exported_to_anki`);
--> statement-breakpoint
CREATE VIRTUAL TABLE vocab_notes_fts USING fts5(
  vocab_id UNINDEXED,
  user_notes,
  tokenize='unicode61'
);
--> statement-breakpoint
CREATE VIRTUAL TABLE lookup_context_fts USING fts5(
  lookup_id UNINDEXED,
  context,
  tokenize='unicode61'
);