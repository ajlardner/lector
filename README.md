# Lector

A reading-based language-learning tool. Paste Spanish text, click words or select phrases for in-context translation, and every lookup is persisted to a local SQLite database in your browser.

**Live demo:** https://ajlardner.github.io/lector

## Features (M1)

- Paste raw Spanish text into the Reader.
- Click a single word → dictionary translation (Wiktionary).
- Select a phrase → structured LLM translation (Anthropic Claude Haiku 4.5) with lemma, part of speech, grammar notes, and examples.
- Two translation modes:
  - **Demo** (default, no setup): LLM calls go through a rate-limited backend proxy.
  - **BYO-key**: paste your own Anthropic API key in Settings; calls go direct from your browser.
- Every lookup is logged to a client-side SQLite database (OPFS-backed). Your vocab never leaves your browser.

## Architecture

- **Frontend** (`apps/web`): Vite + React + TypeScript strict, Tailwind + shadcn/ui, Zustand, SQLite-wasm + OPFS, Drizzle ORM, Sonner toasts.
- **Backend** (`apps/api`): Hono on Fly.io. Two endpoints: `/api/translate` (Anthropic proxy, rate-limited) and `/api/health`. Stores nothing.
- **Shared** (`packages/shared`): Zod schemas, types, built-in prompts.

Full design in `docs/superpowers/specs/2026-04-16-lector-m1-design.md`.

## Local development

Requires Node 20.11+ and pnpm 9.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # fill in ANTHROPIC_API_KEY
cp apps/web/.env.example apps/web/.env   # default points at local api
pnpm dev                                  # runs web (:5173) and api (:8787) in parallel
```

Open http://localhost:5173.

## Scripts

- `pnpm dev` — run web + api in parallel
- `pnpm build` — build all workspaces
- `pnpm typecheck` — strict TS across the monorepo
- `pnpm lint` — ESLint
- `pnpm test` — Vitest across the monorepo

## Deploy

- **Frontend**: `main` auto-deploys to GitHub Pages via `.github/workflows/deploy-web.yml`. Requires:
  - In repo **Settings → Pages**, set *Source* to "GitHub Actions".
  - (Optional) In repo **Settings → Secrets and variables → Actions → Variables**, set `VITE_API_BASE_URL` to your Fly API URL, and `BASE_PATH` if using a custom domain (defaults to `/<repo>/`).
- **Backend**: `main` auto-deploys to Fly.io via `.github/workflows/deploy-api.yml`. Needs `FLY_API_TOKEN` secret and an Anthropic key set via `flyctl secrets set ANTHROPIC_API_KEY=...`.

## Status

Phase 1 of 3. See `CLAUDE.md` for the project's phased plan.
