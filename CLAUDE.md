# CLAUDE.md

## Project Overview

A language-learning tool for reading-based acquisition. The user reads articles in a target language (initially Spanish, extensible to others) and needs fast, in-context translation without breaking reading flow. Two translation tiers: a dictionary service for single words and an LLM for contextual phrases, idioms, and grammar. Every lookup is logged to a personal vocabulary database, which can be exported as Anki `.apkg` decks for spaced-repetition review.

Primary use cases:
- Personal daily tool — paste an article in Spanish, click words or select phrases to translate, export session vocabulary to Anki.
- Live portfolio demo — a deployed web app a reviewer can use immediately without installing anything or bringing their own API key.

## Phasing

The project is built in phases to de-risk the core product before investing in browser-extension complexity.

- **Phase 1 (current)**: Deployable web app — static frontend plus a thin backend proxy. Article ingestion via paste (URL or raw text). All translation, vocabulary tracking, and Anki export features. Single-user data; no auth. Implemented as sequenced milestones (see below).
- **Phase 2 (later)**: Thin browser extension that captures article content from the active tab and sends it to the web app. No in-page overlay, no content-script translation UI. Just an ingestion helper.
- **Phase 3 (maybe)**: Full browser extension with in-page translation overlay. Only pursue if Phase 1 + 2 prove the concept and in-place translation is still a felt need.

Do not build Phase 2 or 3 features into Phase 1. The web app must stand alone.

### Phase 1 Milestones

Each milestone is a shippable slice with its own spec and implementation plan:

- **M1** — Reader + translation core. Paste raw text, clickable/selectable article, dictionary + LLM translation, lookups persisted, vocab upserted. Minimal settings (translation mode, API key). One Spanish built-in prompt. Backend proxy exists from day one (for the LLM path in demo mode).
- **M2** — Vocab view: browse, filter, search, tag, user notes.
- **M3** — Anki export: card templates, `.apkg` generation, `exportedToAnki` flagging.
- **M4** — Prompts management: built-in prompt browser, custom prompt CRUD, prompt test harness.
- **M5** — URL ingestion via the backend Readability endpoint; Article table wired to lookups; recent-articles view.

## Tech Stack

### Frontend (`apps/web`)

- **Language**: TypeScript, strict mode
- **Framework**: Vite + React 18
- **Routing**: React Router
- **State**: Zustand for UI state; SQLite is source of truth for persistent data
- **Styling**: Tailwind CSS + shadcn/ui component primitives (Radix under the hood)
- **Validation**: Zod for LLM responses, stored config, and anything crossing a trust boundary
- **Storage**:
  - SQLite (WASM) via `@sqlite.org/sqlite-wasm`, persisted to OPFS, run in a Web Worker
  - Drizzle ORM for typed queries and migrations
  - `localStorage` for API key and UI preferences only
- **LLM client**: Anthropic SDK (`@anthropic-ai/sdk`) in BYO-key mode; `fetch` to the backend proxy in demo mode. Provider hidden behind an `LLMProvider` interface so OpenRouter or others can be added later.
- **Dictionary**: Wiktionary API (client-side; CORS-friendly). Pluggable interface.
- **Anki export**: `genanki-js` (browser-compatible, produces real `.apkg` files).

### Backend (`apps/api`)

- **Language**: TypeScript, strict mode
- **Framework**: Hono
- **Runtime**: Node 20+ on Fly.io (Vercel Functions acceptable for low-traffic LLM calls if latency budget allows)
- **Validation**: Zod, shared schemas with the frontend
- **Rate limiting**: per-IP + per-session (cookie). In-memory store is fine for now; Redis later if needed.
- **Dependencies**: `@anthropic-ai/sdk` for the translation proxy, `@mozilla/readability` + `jsdom` for URL ingestion.

### Shared (`packages/shared`)

- Zod schemas, TypeScript types, and built-in prompts used by both frontend and backend.

## Architecture

### Monorepo

pnpm workspaces:

```
apps/
  web/                # frontend
  api/                # backend
packages/
  shared/             # zod schemas, types, built-in prompts
```

### Application layout (frontend)

Single-page React app with a few main views:

- **Reader**: the primary surface. Paste a URL or raw text, get a rendered article. Click or select to translate. Inline translation results appear next to the selection.
- **Vocabulary**: browsable list of all looked-up terms. Filter, search, mark for export.
- **Prompts**: manage built-in and custom LLM prompts. Edit, duplicate, test.
- **Settings**: translation mode (demo vs BYO-key), API key, default provider, default prompt per language, dictionary source.
- **Export**: configure Anki deck name, card template, which vocabulary items to include, generate `.apkg`.

### Translation modes

Two modes, toggled in Settings:

- **Demo mode** (default for anonymous visitors): LLM calls route through `apps/api` (`/api/translate`). The server holds the Anthropic key and rate-limits per IP/session. Frontend never sees the key.
- **BYO-key mode**: user enters their own Anthropic key in Settings. LLM calls go directly from the browser to Anthropic via the SDK. Server proxy is bypassed entirely. No server ever sees the key or the lookup.

Dictionary tier always runs client-side against Wiktionary regardless of mode.

### Translation pipeline

Single entry point: `TranslationService.translate(request)`.

```
request → { text, context, sourceLang, targetLang, tier: 'dictionary' | 'llm', promptId? }
         → provider selection (DictionaryProvider or LLMProvider)
         → LLMProvider routes through proxy or direct, based on current mode
         → call
         → log Lookup to SQLite
         → upsert VocabItem
         → return response
```

`DictionaryProvider` and `LLMProvider` are distinct interfaces in `apps/web/src/services/providers/`. Different response shapes, different error modes — do not collapse them.

Dictionary tier triggers on single-word clicks. LLM tier triggers on multi-word selections or explicit user action (keyboard shortcut, button). The surrounding sentence is always sent with LLM requests — translating tokens without context defeats the purpose.

### Backend endpoints

- `POST /api/translate` — accepts `{ text, context, sourceLang, targetLang, promptId }`, calls Anthropic with the server key, returns validated LLM JSON. Rate-limited.
- `POST /api/article` — accepts `{ url }`, fetches server-side, runs Mozilla Readability, returns `{ title, text, language? }`. Rate-limited.
- `GET /api/health` — health check.

No other endpoints. The backend stores nothing persistent.

### Prompts

Structured objects, not raw strings. See `packages/shared/src/prompts.ts`.

```ts
type Prompt = {
  id: string;
  language: string;          // target language code, e.g. 'es'
  name: string;              // user-facing label
  systemPrompt: string;      // template with {variables}
  builtIn: boolean;
  version: number;
}
```

Built-in prompts live in `packages/shared/src/prompts/builtin/` as TypeScript files, one per language. Each language ships with multiple variants (literal, grammar-focused, idiomatic). Custom user prompts live in SQLite.

Template variables available to every prompt: `{selectedText}`, `{surroundingContext}`, `{sourceLanguage}`, `{targetLanguage}`.

### LLM response schema

Every LLM translation must return structured JSON validated by Zod, not freeform text. This is what makes Anki export work cleanly. Schema lives in `packages/shared/src/schemas/llm.ts` and is imported by both the frontend (BYO-key path) and backend (demo-mode path).

```ts
type LLMTranslation = {
  translation: string;           // the primary translation
  lemma?: string;                // dictionary form, for vocab dedup
  partOfSpeech?: string;
  grammarNotes?: string;         // optional grammar explanation
  examples?: { source: string; translation: string }[];
  alternativeTranslations?: string[];
}
```

Prompts instruct the model to return JSON matching this shape. Responses that fail Zod parsing get one retry with a correction prompt, then fall through with an error state.

## Data Model (SQLite)

Four core tables. Separation matters: the same word gets looked up many times, and the vocabulary list needs deduplication, frequency, and SRS state.

- **lookups**: append-only log of every translation. `{id, timestamp, source_text, source_lang, translation, context, article_id?, provider, prompt_id?, tier, raw_response}`
- **vocab_items**: deduplicated per `(lemma, language)`. `{id, lemma, language, first_seen_at, lookup_count, last_seen_at, user_notes, tags, exported_to_anki}`
- **articles**: source material. `{id, url?, title, raw_text, language, added_at}`
- **prompts**: user-created prompts (built-ins are in code). `{id, language, name, system_prompt, created_at, updated_at}`

Schema and migrations are managed with Drizzle. All writes go through `apps/web/src/services/db/` repositories. Never touch SQLite directly from components.

FTS5 virtual tables sit on top of `vocab_items.user_notes` and `lookups.context` for search. Defined in the same migrations.

## Anki Export

Uses `genanki-js` to generate `.apkg` files in the browser. User downloads the file and imports it into Anki.

Default note type has four fields:

- `Front` — the source term (or lemma)
- `Back` — the translation
- `Context` — the sentence it appeared in, with the term highlighted
- `Notes` — grammar notes, examples, or user notes

Export flow:
1. User selects vocabulary items from the vocab view (filter by date, language, tag, or "not yet exported")
2. User picks or configures a card template
3. System generates `.apkg`, triggers download
4. Exported items get `exported_to_anki: true` so they can be filtered out of future exports

Card templates are stored and editable — at minimum, ship one basic template and one cloze-deletion template.

## Folder Structure

```
apps/
  web/
    src/
      views/
        reader/
        vocab/
        prompts/
        settings/
        export/
      services/
        providers/        # DictionaryProvider, LLMProvider implementations
        db/               # Drizzle client, schema, repositories, migrations
        anki/             # genanki-js wrapper, card templates
        translation/      # TranslationService orchestration
        storage.ts        # localStorage wrapper
      components/         # reusable React components
      store/              # Zustand stores
    index.html
    vite.config.ts
  api/
    src/
      routes/
        translate.ts
        article.ts
        health.ts
      middleware/
        rate-limit.ts
      anthropic.ts
      readability.ts
      index.ts
    package.json
packages/
  shared/
    src/
      schemas/            # Zod schemas (LLM response, API request/response)
      types/              # shared TypeScript types
      prompts/
        builtin/          # shipped prompts per language
      prompts.ts
    package.json
pnpm-workspace.yaml
package.json
```

## Deployment

- **Frontend**: Vercel (static Vite build). Preview deploys per branch.
- **Backend**: Fly.io. One small Node service; 256–512MB instance is enough for Phase 1.
- **Env vars (server)**: `ANTHROPIC_API_KEY`, `RATE_LIMIT_PER_HOUR` (default 20), `ALLOWED_ORIGINS`.
- **Env vars (client)**: `VITE_API_BASE_URL`.
- **CI**: GitHub Actions. Typecheck + lint + test on PR. Deploy frontend to Vercel and backend to Fly on main merge.

## Coding Conventions

- TypeScript strict mode everywhere. No `any` without a comment explaining why.
- Functional React components, hooks only.
- File names: `kebab-case.ts` for modules, `PascalCase.tsx` for React components.
- Named exports preferred. Default exports only for route-level view components.
- All async calls wrapped in `try/catch`. Use `Result<T, E>` pattern in `packages/shared/src/result.ts` for expected failures; throw for bugs.
- Zod validates anything crossing a trust boundary: LLM responses, backend API responses, data read from SQLite, stored config.
- No direct SQLite or `localStorage` calls in components. Go through `apps/web/src/services/db/` and `apps/web/src/services/storage.ts`.
- Tests colocated: `foo.ts` ↔ `foo.test.ts`. Vitest + `@testing-library/react` for components.
- TDD: write the test first, run red, write the minimum code to go green, refactor, rerun green.

## Commands

All commands run from repo root; pnpm workspaces handles routing.

```
pnpm dev              # web + api in parallel
pnpm dev:web          # frontend only
pnpm dev:api          # backend only
pnpm build            # build all workspaces
pnpm typecheck        # tsc --noEmit across all workspaces
pnpm lint             # eslint across all workspaces
pnpm test             # vitest across all workspaces
pnpm test:watch       # vitest watch
pnpm db:generate      # drizzle-kit generate migrations
pnpm db:push          # apply migrations (dev)
```

Typecheck after any significant change.

## Important Rules

- **Key handling**:
  - In *BYO-key mode*, the Anthropic key is stored in `localStorage` and never leaves the browser. It is NOT sent to the backend.
  - In *demo mode*, the server holds the key. The client has no key. Requests are rate-limited per IP + session.
  - Never log keys or request/response bodies server-side. Metadata (timestamp, IP, token count, status) is fine.
- **Privacy**: vocabulary and lookup history are stored client-side (SQLite + OPFS). The server never sees or stores them. `.apkg` export happens entirely in the browser.
- **Lookup logging is not optional**. Every successful translation writes to SQLite, even if vocab UI is not the current focus.
- When adding a new language, ship at least one built-in prompt for it. A language without a prompt is unsupported.
- LLM prompts must request structured JSON. Freeform text responses break vocab dedup and Anki export.
- Article text stays local. The backend `/api/article` endpoint fetches and returns text to the browser but does not store it. Only the selected term plus surrounding context is sent to the LLM (or the LLM proxy).
- No auth, user accounts, or server-side persistence in Phase 1.
- Do not build Phase 2 extension features into Phase 1.

## Progressive Disclosure

Task-specific details live next to the code:

- `apps/web/src/services/providers/CLAUDE.md` — provider interface contracts, adding a new provider
- `apps/web/src/services/anki/CLAUDE.md` — genanki-js usage, card template design
- `apps/web/src/services/db/CLAUDE.md` — Drizzle schema, migrations, repository patterns, FTS
- `apps/api/CLAUDE.md` — backend endpoints, rate-limit strategy, deployment notes
- `packages/shared/src/prompts/CLAUDE.md` — prompt template variables, JSON schema requirements, adding a new language
