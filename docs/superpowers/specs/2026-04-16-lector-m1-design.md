# Lector — Milestone 1 Design

**Date:** 2026-04-16
**Milestone:** M1 — Reader + translation core
**Scope:** First of five Phase 1 milestones. Stands up the monorepo, deploys end-to-end, and delivers the thinnest vertical slice through every architectural layer.

---

## 1. Goals

M1 must deliver two things at once:

1. **A working personal tool** — paste Spanish text, click or select to translate, with lookups persisted to a local SQLite DB.
2. **A deployed portfolio demo** — a live URL a reviewer can click and use in under 10 seconds, with no setup and no API key required.

A reviewer's first 30 seconds should be: open URL → see seeded Spanish article → click a word → see translation popover → select a phrase → see structured LLM translation. That's the proof.

M1 is also the architectural backbone for M2–M5. Every decision that would cost much more to change later (storage choice, monorepo shape, backend proxy, provider interfaces, mode handling) lands in M1.

## 2. Non-goals

Out of scope for M1, to keep it shippable:

- Vocab browsing UI (M2)
- Anki export (M3)
- Prompts management UI, custom prompts (M4)
- URL ingestion, `/api/article` endpoint, Article table usage beyond raw-text inserts (M5)
- Multiple target languages — Spanish only
- Dictionary / LLM provider swap in Settings (Wiktionary + Anthropic are hardcoded in M1)
- Auth, accounts, server-side persistence of lookups or vocab
- Mobile-specific layouts (desktop-first; must not be broken on mobile but isn't tuned)
- E2E tests (component tests cover M1; E2E arrives in M2 or M3)

## 3. User flows

### 3.1 Demo-mode visitor (default for anonymous users)

1. Visitor lands on `/`. Reader view opens with a seeded Spanish article already rendered as clickable tokens.
2. Visitor clicks a single Spanish word → dictionary popover appears next to the word with Wiktionary translation + part of speech.
3. Visitor selects a multi-word phrase → LLM popover appears with structured translation (primary translation, lemma, grammar notes, examples).
4. Every call to the LLM tier routes through `POST /api/translate` on the backend, which holds the Anthropic key. Rate-limited per IP (20/hr) and per session cookie (50/day).
5. Every successful lookup writes a row to the client-side `lookups` table and upserts a row in `vocab_items`.
6. Visitor can replace the seeded article by pasting their own text into the Reader's input and clicking "Read".

### 3.2 BYO-key mode (power user)

1. User opens Settings, toggles mode to "Use my own key", and pastes an Anthropic API key. Key persists in `localStorage` only.
2. Subsequent LLM calls bypass the backend proxy and go directly from the browser to the Anthropic API via the `@anthropic-ai/sdk`.
3. No rate limits apply. No server sees the key or the lookups.
4. Dictionary tier is unchanged (client-side Wiktionary in both modes).

### 3.3 First-run behavior

On first load, the client creates the SQLite database in OPFS and runs all Drizzle migrations. Seed article is inlined in the bundle, not stored in DB. Translation mode defaults to demo.

## 4. Architecture summary

Full details live in `CLAUDE.md`. M1-relevant shape:

```
apps/web (Vite + React + TS strict)
  ├─ Reader view: paste textarea + tokenized article renderer + popover results
  ├─ Settings view: mode toggle + API key input
  ├─ services/translation: TranslationService entry point
  ├─ services/providers: DictionaryProvider (Wiktionary), LLMProvider (Anthropic, mode-aware)
  ├─ services/db: SQLite-wasm in Worker, Drizzle ORM, repositories
  └─ store: Zustand for UI state (current mode, current lookup, toast queue)

apps/api (Hono on Fly.io)
  ├─ POST /api/translate: Anthropic proxy, Zod-validated, rate-limited
  └─ GET  /api/health:    liveness

packages/shared
  ├─ schemas: Zod (LLMTranslation, API request/response)
  ├─ types: TypeScript types for Lookup, VocabItem, Article, Prompt
  └─ prompts/builtin/es-basic.ts: the one shipped Spanish prompt
```

### 4.1 Translation pipeline

Single entry point: `TranslationService.translate(request)`. Pipeline:

1. Route by tier: `dictionary` → Wiktionary client-side; `llm` → LLMProvider.
2. In `llm` tier, LLMProvider inspects current mode from the store:
   - Demo mode → `fetch('/api/translate', ...)` to backend
   - BYO-key mode → direct `@anthropic-ai/sdk` call with localStorage key
3. Validate response with Zod. On Zod failure, retry once with a correction prompt. On second failure, surface fallback: raw `translation` string only, toast warns structured parse failed.
4. Write `Lookup` row. Upsert `VocabItem` on `(lemma, language)`.
5. Return `Result<TranslationResponse, TranslationError>` to caller.

### 4.2 Backend shape

Hono app, single file per route. Rate-limit middleware wraps `/api/translate`: per-IP counter (20/hr) and per-session-cookie counter (50/day), both in-memory. On rate-limit hit, returns 429 with JSON body `{ error: 'rate_limited', retryAfter: <seconds> }`. CORS allowlist from `ALLOWED_ORIGINS` env var.

Request body shape:

```ts
{
  text: string;
  context: string;
  sourceLang: 'es';
  targetLang: 'en';
  promptId: string;
}
```

Response body shape: the validated `LLMTranslation` schema, plus metadata `{ latencyMs, model }`.

## 5. Technical decisions

### 5.1 Storage: SQLite-wasm + OPFS + Drizzle

Chosen over IndexedDB because the query shapes are genuinely relational (filter vocab by lang + tag + exported + date, search user notes, join lookups to articles). SQLite gives us SQL, FTS5, and a portable single-file DB that is trivial to back up. Drizzle provides typed queries and structured migrations.

Trade-off accepted: ~1–2MB WASM bundle. Acceptable for a local single-user app.

### 5.2 Delivery: deployed web app

Chosen over Electron / Tauri because the portfolio demo requires a clickable URL. Electron would block review. Native wrap remains cheap to add later if desired — OPFS-SQLite schema transfers directly to server-side SQLite under `better-sqlite3`.

### 5.3 Frontend stack: Tailwind + shadcn/ui

Radix-based primitives (popover, dialog, button, input, textarea, toggle) covered out of the box. Matches the inline-popover-heavy UX this app needs.

### 5.4 Tokenization: `Intl.Segmenter`

Native browser API. Word-granularity, locale-aware (`'es'`), handles Spanish diacritics and compound punctuation without regex hacks. No library dependency.

### 5.5 LLM model: `claude-haiku-4-5`

Default for all LLM translations in M1. Fast (inline UX matters), cheap (matters for demo-mode rate-limiting), and more than capable of a sentence-in-context translation with structured JSON output. Sonnet 4.6 can be exposed as a user-selectable upgrade in a later milestone.

### 5.6 Rate limits (demo mode)

- `/api/translate`: 20 calls per hour per IP **and** 50 calls per day per session cookie.
- Tunable via `RATE_LIMIT_PER_HOUR` and `RATE_LIMIT_PER_DAY` env vars.
- Bypassed entirely in BYO-key mode.

Rationale: 20/hr gives a meaningful try; 50/day session cap limits IP-rotation abuse; both are trivially overridable when we learn more.

### 5.7 Seed article

Bespoke ~150-word Spanish article, written in-house, committed under `apps/web/src/views/reader/seed-article.ts`. Modern register, deliberately seeded with 2–3 idioms and 1–2 subjunctive verbs so the LLM tier produces visibly richer output than the dictionary tier. No licensing risk.

### 5.8 Error handling UX

- Toast lib: `sonner` (Radix-family, shadcn-standard).
- Network / 5xx → toast with "Retry" action; popover shows "Translation failed".
- 429 (demo rate limit) → toast: "Demo limit reached. Add your own Anthropic key in Settings to keep translating."
- Zod validation failure after one retry → popover shows raw `translation` string; toast warns the structured parse failed. Lookup still logged with `raw_response` intact.
- `Result<T, E>` used throughout the service layer. UI components render both arms explicitly.

## 6. Data model (M1-relevant subset)

All four tables are created in M1 migrations. Only `lookups` and `vocab_items` are actively written to in M1: every translation logs a row to `lookups` and upserts a row in `vocab_items`. The `articles` table is created but receives no inserts in M1 — `lookup.article_id` is null for M1 lookups. Article persistence is M5. The `prompts` table exists but stays empty; the one built-in Spanish prompt is resolved from `packages/shared/src/prompts/builtin/` rather than the DB in M1.

Drizzle schema lives in `apps/web/src/services/db/schema.ts`. See `CLAUDE.md` § Data Model for field-level details.

FTS5 virtual tables on `vocab_items.user_notes` and `lookups.context` are created in M1 migrations even though the UI that uses them arrives in M2.

## 7. Testing strategy

TDD per global rules. Every new piece of functionality ships test-first.

### Unit
- Zod schemas: accept valid shape, reject each required-field omission.
- `TranslationService`: routes by tier, upserts vocab, logs lookup, handles retries, emits `Result` both arms.
- `LLMProvider`: mode-aware routing (direct vs proxy), retry logic, Zod validation.
- `DictionaryProvider`: Wiktionary response shape → internal response shape.
- Rate-limit middleware: IP counter, session counter, 429 response shape.
- Tokenization: Spanish edge cases (diacritics, contractions like "del", punctuation).

### Integration
- Backend `/api/translate` with Anthropic SDK mocked: happy path, Anthropic 429, Anthropic 5xx, schema retry.
- SQLite migrations apply clean from empty OPFS.
- Repository CRUD against in-memory SQLite (`:memory:` in tests).

### Component (Vitest + @testing-library/react)
- Reader renders tokens; single-click vs multi-word selection dispatches correct tier.
- Popover renders dictionary result shape and LLM result shape differently.
- Settings toggle flips mode and persists to localStorage.

### Manual acceptance
- Deployed demo URL loads the seeded article in under 2s on a cold cache.
- Demo-mode click + select both produce visible results.
- BYO-key mode with a real key produces results identical to demo mode.
- Clearing browser site data resets vocab DB cleanly (no stuck migrations).

## 8. Deployment

- **Frontend**: Vercel, Vite static build. Preview per branch; `main` → production.
- **Backend**: Fly.io, single small Node instance (256–512MB). `main` → production via GitHub Actions.
- **Env vars (server)**: `ANTHROPIC_API_KEY`, `RATE_LIMIT_PER_HOUR=20`, `RATE_LIMIT_PER_DAY=50`, `ALLOWED_ORIGINS`.
- **Env vars (client)**: `VITE_API_BASE_URL`.
- **CI**: GitHub Actions — `pnpm typecheck && pnpm lint && pnpm test` on PR; deploys on main merge.
- **README**: live demo link, screenshots (Reader with dictionary popover, Reader with LLM popover, Settings), one-paragraph architecture summary, "how to self-host" section.

## 9. Definition of done

1. Monorepo stands up cleanly from `pnpm install` on a fresh clone.
2. `pnpm dev` runs both `web` and `api` locally.
3. `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass with meaningful coverage on services, providers, repositories, rate-limit middleware, and tokenizer.
4. Deployed at a real URL (Vercel + Fly), both demo mode and BYO-key mode functional end-to-end.
5. Seeded Spanish article renders on first visit; clicking a word shows a dictionary popover; selecting a phrase shows a structured LLM popover.
6. Every successful translation produces a row in `lookups` and an upsert in `vocab_items`, verified by a dev-only `/debug` route that lists both tables (dev build only; excluded from production bundle).
7. Rate limit on `/api/translate` verifiably returns 429 after 20 calls/hr in demo mode.
8. Zod validation failure paths surface sensibly (fallback translation visible, toast warns).
9. CI green on `main`. README published with demo link.

## 10. Risks and mitigations

- **OPFS quirks on Safari** — persistence is generally solid now, but Safari has historically trailed. Mitigation: include a one-time "Safari support is experimental" notice in Settings if the UA is Safari; verify manually during M1 deployment. If it's bad, we add a fallback IndexedDB-backed SQLite adapter (a ~1 day change; SQLite-wasm supports it).
- **Anthropic rate-limit on your account under demo traffic** — if the demo goes unexpectedly viral, your Anthropic bill spikes. Mitigation: tight demo-mode rate limits (20/hr/IP), surface 429 prominently, consider a daily global budget env var in M2 if it becomes a problem.
- **Tokenization ambiguity for compound forms** — `Intl.Segmenter` splits "del" as one token; users may want to look up "de" and "el" separately. Mitigation: accept the segmenter's output in M1; revisit if real usage flags it.
- **LLM JSON drift** — even Haiku occasionally strays from the schema. Mitigation: single retry with a correction prompt; fallback to raw `translation` string; always log `raw_response` for debugging.

## 11. What happens after M1

M2 builds the Vocab browsing view on top of the `vocab_items` table that M1 has been populating. M3 adds Anki export. M4 adds prompts management. M5 adds URL ingestion and wires the `articles` table to lookups. Each gets its own spec and plan.
