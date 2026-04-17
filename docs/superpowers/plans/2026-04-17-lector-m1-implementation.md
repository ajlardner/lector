# Lector M1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the deployed M1 slice of Lector — a reader-based language-learning tool. The user can paste Spanish text, click single words for a dictionary translation, select phrases for an LLM translation, and every lookup is persisted to a client-side SQLite database. Runs as a web app at a real URL with both a demo-mode backend proxy and a BYO-key direct path.

**Architecture:** pnpm monorepo with three packages — `apps/web` (Vite + React + TS + SQLite-wasm + OPFS + Drizzle), `apps/api` (Hono on Fly.io wrapping the Anthropic SDK with rate limits), `packages/shared` (Zod schemas, types, built-in prompts). Tailwind + shadcn/ui for the UI. TDD throughout; tests colocated with code.

**Tech Stack:** TypeScript strict, pnpm workspaces, Vite, React 18, React Router, Zustand, Tailwind, shadcn/ui, sonner, `@sqlite.org/sqlite-wasm`, Drizzle ORM, `@anthropic-ai/sdk`, Hono, Vitest, `@testing-library/react`, Mozilla Readability (M5 only — not in this plan).

**Spec:** `docs/superpowers/specs/2026-04-16-lector-m1-design.md`

---

## Table of contents

- Phase A — Monorepo + shared package (Tasks 1–6)
- Phase B — Backend `apps/api` (Tasks 7–13)
- Phase C — Frontend scaffold + storage (Tasks 14–20)
- Phase D — Frontend services (Tasks 21–25)
- Phase E — UI (Tasks 26–32)
- Phase F — Deploy + README (Tasks 33–35)

---

## Conventions used in this plan

- **Every test-first task is:** write failing test → run (expect fail) → minimal implementation → run (expect pass) → commit.
- **Commit messages** follow Conventional Commits (`feat(scope):`, `test(scope):`, `chore(scope):`, `refactor(scope):`). Scope is the directory or component.
- **Commands** assume repo root unless noted.
- **Node version:** 20.x (pin via `.node-version`). **pnpm version:** 9.x (pin via `packageManager` field in root `package.json`).
- **All `git commit` steps below include** `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` in the trailer. Omit for brevity in individual steps — add to every commit regardless.

---

# Phase A — Monorepo + shared package

## Task 1: Monorepo root files

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.node-version`
- Create: `.editorconfig`
- Create: `.prettierrc.json`
- Create: `.prettierignore`
- Create: `.eslintrc.cjs`

- [ ] **Step 1: Write `.node-version`**

```
20.11.1
```

- [ ] **Step 2: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Write root `package.json`**

```json
{
  "name": "lector",
  "private": true,
  "version": "0.0.0",
  "packageManager": "pnpm@9.12.0",
  "engines": {
    "node": ">=20.11.0"
  },
  "scripts": {
    "dev": "pnpm -r --parallel --filter=./apps/* dev",
    "dev:web": "pnpm --filter ./apps/web dev",
    "dev:api": "pnpm --filter ./apps/api dev",
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test",
    "test:watch": "pnpm -r --parallel test:watch",
    "format": "prettier --write .",
    "db:generate": "pnpm --filter ./apps/web db:generate",
    "db:push": "pnpm --filter ./apps/web db:push"
  },
  "devDependencies": {
    "prettier": "^3.3.3",
    "typescript": "^5.6.2",
    "eslint": "^9.12.0",
    "@typescript-eslint/parser": "^8.8.0",
    "@typescript-eslint/eslint-plugin": "^8.8.0"
  }
}
```

- [ ] **Step 4: Write `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 5: Write `.editorconfig`**

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 6: Write `.prettierrc.json`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 7: Write `.prettierignore`**

```
node_modules
dist
build
.vite
.next
coverage
pnpm-lock.yaml
```

- [ ] **Step 8: Write `.eslintrc.cjs`**

```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  env: {
    es2022: true,
    node: true,
    browser: true,
  },
  ignorePatterns: ['dist', 'build', '.vite', 'coverage', '*.config.*', 'node_modules'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
};
```

- [ ] **Step 9: Install and verify**

Run: `pnpm install`
Expected: no errors, `pnpm-lock.yaml` created, `node_modules/` populated.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore(repo): monorepo baseline (pnpm, ts, eslint, prettier)"
```

---

## Task 2: `packages/shared` scaffold + `Result<T, E>`

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/vitest.config.ts`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/result.ts`
- Create: `packages/shared/src/result.test.ts`

- [ ] **Step 1: Write `packages/shared/package.json`**

```json
{
  "name": "@lector/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./schemas/*": "./src/schemas/*.ts",
    "./prompts/*": "./src/prompts/*.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.6.2",
    "vitest": "^2.1.2"
  },
  "dependencies": {
    "zod": "^3.23.8"
  }
}
```

- [ ] **Step 2: Write `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Write `packages/shared/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Write failing test for `Result<T, E>`**

`packages/shared/src/result.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ok, err, isOk, isErr, map, mapErr, unwrap } from './result.js';

describe('Result', () => {
  it('ok wraps a value', () => {
    const r = ok(42);
    expect(isOk(r)).toBe(true);
    expect(isErr(r)).toBe(false);
    if (isOk(r)) expect(r.value).toBe(42);
  });

  it('err wraps an error', () => {
    const r = err('boom');
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error).toBe('boom');
  });

  it('map transforms ok value', () => {
    expect(map(ok(2), (n) => n * 3)).toEqual(ok(6));
  });

  it('map passes through err unchanged', () => {
    expect(map(err('x'), (n: number) => n * 3)).toEqual(err('x'));
  });

  it('mapErr transforms err', () => {
    expect(mapErr(err('x'), (s) => s.toUpperCase())).toEqual(err('X'));
  });

  it('unwrap returns ok value', () => {
    expect(unwrap(ok(7))).toBe(7);
  });

  it('unwrap throws on err', () => {
    expect(() => unwrap(err('boom'))).toThrow('boom');
  });
});
```

- [ ] **Step 5: Run the test — expect failure**

Run: `pnpm --filter @lector/shared test`
Expected: module `./result.js` not found.

- [ ] **Step 6: Implement `result.ts`**

`packages/shared/src/result.ts`:

```ts
export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export const isOk = <T, E>(r: Result<T, E>): r is Ok<T> => r.ok;
export const isErr = <T, E>(r: Result<T, E>): r is Err<E> => !r.ok;

export const map = <T, U, E>(r: Result<T, E>, f: (t: T) => U): Result<U, E> =>
  isOk(r) ? ok(f(r.value)) : r;

export const mapErr = <T, E, F>(r: Result<T, E>, f: (e: E) => F): Result<T, F> =>
  isErr(r) ? err(f(r.error)) : r;

export const unwrap = <T, E>(r: Result<T, E>): T => {
  if (isOk(r)) return r.value;
  throw r.error instanceof Error ? r.error : new Error(String(r.error));
};
```

- [ ] **Step 7: Write `packages/shared/src/index.ts`**

```ts
export * from './result.js';
```

- [ ] **Step 8: Run tests — expect pass**

Run: `pnpm --filter @lector/shared test`
Expected: all 7 tests pass.

- [ ] **Step 9: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): Result<T,E> utility with tests"
```

---

## Task 3: Shared Zod schema — `LLMTranslation`

**Files:**
- Create: `packages/shared/src/schemas/llm.ts`
- Create: `packages/shared/src/schemas/llm.test.ts`

- [ ] **Step 1: Write failing test**

`packages/shared/src/schemas/llm.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { LLMTranslationSchema } from './llm.js';

describe('LLMTranslationSchema', () => {
  it('accepts minimal shape', () => {
    const r = LLMTranslationSchema.safeParse({ translation: 'the house' });
    expect(r.success).toBe(true);
  });

  it('accepts full shape', () => {
    const r = LLMTranslationSchema.safeParse({
      translation: 'the house',
      lemma: 'casa',
      partOfSpeech: 'noun',
      grammarNotes: 'feminine singular',
      examples: [{ source: 'la casa es roja', translation: 'the house is red' }],
      alternativeTranslations: ['home'],
    });
    expect(r.success).toBe(true);
  });

  it('rejects missing translation', () => {
    const r = LLMTranslationSchema.safeParse({ lemma: 'casa' });
    expect(r.success).toBe(false);
  });

  it('rejects example missing translation field', () => {
    const r = LLMTranslationSchema.safeParse({
      translation: 'x',
      examples: [{ source: 'y' }],
    });
    expect(r.success).toBe(false);
  });

  it('rejects non-string translation', () => {
    const r = LLMTranslationSchema.safeParse({ translation: 42 });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `pnpm --filter @lector/shared test`
Expected: import error.

- [ ] **Step 3: Implement schema**

`packages/shared/src/schemas/llm.ts`:

```ts
import { z } from 'zod';

export const LLMExampleSchema = z.object({
  source: z.string(),
  translation: z.string(),
});

export const LLMTranslationSchema = z.object({
  translation: z.string().min(1),
  lemma: z.string().optional(),
  partOfSpeech: z.string().optional(),
  grammarNotes: z.string().optional(),
  examples: z.array(LLMExampleSchema).optional(),
  alternativeTranslations: z.array(z.string()).optional(),
});

export type LLMTranslation = z.infer<typeof LLMTranslationSchema>;
export type LLMExample = z.infer<typeof LLMExampleSchema>;
```

- [ ] **Step 4: Export from index**

Append to `packages/shared/src/index.ts`:

```ts
export * from './schemas/llm.js';
```

- [ ] **Step 5: Run — expect pass**

Run: `pnpm --filter @lector/shared test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): LLMTranslation zod schema"
```

---

## Task 4: Shared Zod schemas — API contract

**Files:**
- Create: `packages/shared/src/schemas/api.ts`
- Create: `packages/shared/src/schemas/api.test.ts`

- [ ] **Step 1: Write failing test**

`packages/shared/src/schemas/api.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  TranslateRequestSchema,
  TranslateResponseSchema,
  ApiErrorSchema,
} from './api.js';

describe('TranslateRequestSchema', () => {
  it('accepts valid request', () => {
    const r = TranslateRequestSchema.safeParse({
      text: 'caminaba',
      context: 'El hombre caminaba por la calle.',
      sourceLang: 'es',
      targetLang: 'en',
      promptId: 'es-basic',
    });
    expect(r.success).toBe(true);
  });

  it('rejects empty text', () => {
    const r = TranslateRequestSchema.safeParse({
      text: '',
      context: 'x',
      sourceLang: 'es',
      targetLang: 'en',
      promptId: 'es-basic',
    });
    expect(r.success).toBe(false);
  });

  it('rejects unknown sourceLang', () => {
    const r = TranslateRequestSchema.safeParse({
      text: 'x',
      context: 'x',
      sourceLang: 'xx',
      targetLang: 'en',
      promptId: 'es-basic',
    });
    expect(r.success).toBe(false);
  });
});

describe('TranslateResponseSchema', () => {
  it('accepts valid response', () => {
    const r = TranslateResponseSchema.safeParse({
      result: { translation: 'he was walking' },
      metadata: { latencyMs: 342, model: 'claude-haiku-4-5' },
    });
    expect(r.success).toBe(true);
  });
});

describe('ApiErrorSchema', () => {
  it('accepts rate_limited error', () => {
    const r = ApiErrorSchema.safeParse({ error: 'rate_limited', retryAfter: 120 });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `pnpm --filter @lector/shared test`
Expected: import error.

- [ ] **Step 3: Implement schemas**

`packages/shared/src/schemas/api.ts`:

```ts
import { z } from 'zod';
import { LLMTranslationSchema } from './llm.js';

export const SupportedSourceLang = z.enum(['es']);
export const SupportedTargetLang = z.enum(['en']);

export const TranslateRequestSchema = z.object({
  text: z.string().min(1).max(2000),
  context: z.string().max(4000),
  sourceLang: SupportedSourceLang,
  targetLang: SupportedTargetLang,
  promptId: z.string().min(1),
});

export const TranslateResponseSchema = z.object({
  result: LLMTranslationSchema,
  metadata: z.object({
    latencyMs: z.number().nonnegative(),
    model: z.string(),
  }),
});

export const ApiErrorSchema = z.object({
  error: z.enum(['rate_limited', 'bad_request', 'upstream_error', 'internal']),
  message: z.string().optional(),
  retryAfter: z.number().optional(),
});

export type TranslateRequest = z.infer<typeof TranslateRequestSchema>;
export type TranslateResponse = z.infer<typeof TranslateResponseSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
```

- [ ] **Step 4: Export from index**

Append to `packages/shared/src/index.ts`:

```ts
export * from './schemas/api.js';
```

- [ ] **Step 5: Run — expect pass**

- [ ] **Step 6: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): API contract zod schemas"
```

---

## Task 5: Shared types for DB rows

**Files:**
- Create: `packages/shared/src/types/db.ts`

These types mirror the DB row shape. They are the boundary contract between the client DB layer and the rest of the app. Drizzle will generate its own types in Phase C; these are the app-facing types.

- [ ] **Step 1: Write `packages/shared/src/types/db.ts`**

```ts
export type LookupRow = {
  id: string;
  timestamp: number;
  sourceText: string;
  sourceLang: string;
  translation: string;
  context: string;
  articleId: string | null;
  provider: 'wiktionary' | 'anthropic';
  promptId: string | null;
  tier: 'dictionary' | 'llm';
  rawResponse: string;
};

export type VocabItemRow = {
  id: string;
  lemma: string;
  language: string;
  firstSeenAt: number;
  lookupCount: number;
  lastSeenAt: number;
  userNotes: string;
  tags: string[];
  exportedToAnki: boolean;
};

export type ArticleRow = {
  id: string;
  url: string | null;
  title: string;
  rawText: string;
  language: string;
  addedAt: number;
};

export type PromptRow = {
  id: string;
  language: string;
  name: string;
  systemPrompt: string;
  builtIn: boolean;
  version: number;
  createdAt: number;
  updatedAt: number;
};
```

- [ ] **Step 2: Export from index**

Append:

```ts
export * from './types/db.js';
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @lector/shared typecheck`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): DB row types"
```

---

## Task 6: Built-in Spanish prompt

**Files:**
- Create: `packages/shared/src/prompts.ts`
- Create: `packages/shared/src/prompts/builtin/es-basic.ts`
- Create: `packages/shared/src/prompts/builtin/es-basic.test.ts`
- Create: `packages/shared/src/prompts/builtin/index.ts`

- [ ] **Step 1: Write `packages/shared/src/prompts.ts`**

```ts
import { z } from 'zod';

export const PromptSchema = z.object({
  id: z.string().min(1),
  language: z.string().min(2).max(8),
  name: z.string().min(1),
  systemPrompt: z.string().min(1),
  builtIn: z.boolean(),
  version: z.number().int().positive(),
});

export type Prompt = z.infer<typeof PromptSchema>;
```

- [ ] **Step 2: Write failing test**

`packages/shared/src/prompts/builtin/es-basic.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { esBasicPrompt } from './es-basic.js';
import { PromptSchema } from '../../prompts.js';

describe('esBasicPrompt', () => {
  it('is a valid Prompt', () => {
    expect(PromptSchema.safeParse(esBasicPrompt).success).toBe(true);
  });

  it('has language es and is builtIn', () => {
    expect(esBasicPrompt.language).toBe('es');
    expect(esBasicPrompt.builtIn).toBe(true);
  });

  it('mentions all template variables', () => {
    const sp = esBasicPrompt.systemPrompt;
    expect(sp).toContain('{selectedText}');
    expect(sp).toContain('{surroundingContext}');
    expect(sp).toContain('{sourceLanguage}');
    expect(sp).toContain('{targetLanguage}');
  });

  it('instructs the model to return JSON matching LLMTranslation', () => {
    const sp = esBasicPrompt.systemPrompt.toLowerCase();
    expect(sp).toContain('json');
    expect(sp).toContain('translation');
  });
});
```

- [ ] **Step 3: Run — expect failure**

Run: `pnpm --filter @lector/shared test`

- [ ] **Step 4: Implement prompt**

`packages/shared/src/prompts/builtin/es-basic.ts`:

```ts
import type { Prompt } from '../../prompts.js';

export const esBasicPrompt: Prompt = {
  id: 'es-basic',
  language: 'es',
  name: 'Spanish — basic contextual translation',
  builtIn: true,
  version: 1,
  systemPrompt: `You are a translation assistant for a language learner reading articles in {sourceLanguage}.
The user has selected a term in {sourceLanguage} and wants a translation into {targetLanguage}.
Use the surrounding context to disambiguate sense.

Return ONLY a JSON object matching this TypeScript type — no prose, no code fences:

type Response = {
  translation: string;            // the primary {targetLanguage} translation of the selected term in context
  lemma?: string;                 // the dictionary/base form of the selected term
  partOfSpeech?: string;          // e.g., "noun", "verb", "idiom"
  grammarNotes?: string;          // one or two sentences of grammar context if it would help a learner
  examples?: { source: string; translation: string }[];  // 0-2 short example sentences
  alternativeTranslations?: string[];  // other senses or register variants
};

Selected text: {selectedText}
Surrounding context: {surroundingContext}

Respond with the JSON object only.`,
};
```

- [ ] **Step 5: Write `packages/shared/src/prompts/builtin/index.ts`**

```ts
export { esBasicPrompt } from './es-basic.js';
```

- [ ] **Step 6: Export from package index**

Append to `packages/shared/src/index.ts`:

```ts
export * from './prompts.js';
export * from './prompts/builtin/index.js';
```

- [ ] **Step 7: Run — expect pass**

- [ ] **Step 8: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): built-in Spanish prompt with schema and tests"
```

---

# Phase B — Backend (`apps/api`)

## Task 7: Scaffold `apps/api`

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/vitest.config.ts`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/app.test.ts`
- Create: `apps/api/.env.example`

- [ ] **Step 1: Write `apps/api/package.json`**

```json
{
  "name": "@lector/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.32.1",
    "@hono/node-server": "^1.13.1",
    "@hono/zod-validator": "^0.4.1",
    "@lector/shared": "workspace:*",
    "hono": "^4.6.3",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.7.4",
    "tsx": "^4.19.1",
    "typescript": "^5.6.2",
    "vitest": "^2.1.2"
  }
}
```

- [ ] **Step 2: Write `apps/api/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Write `apps/api/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Write failing test**

`apps/api/src/app.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildApp } from './app.js';

describe('buildApp', () => {
  it('returns a Hono app with GET /api/health', async () => {
    const app = buildApp({
      anthropicKey: 'test-key',
      rateLimitPerHour: 20,
      rateLimitPerDay: 50,
      allowedOrigins: ['http://localhost:5173'],
    });
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});
```

- [ ] **Step 5: Install deps**

Run: `pnpm install`

- [ ] **Step 6: Run — expect failure**

Run: `pnpm --filter @lector/api test`
Expected: import error on `./app.js`.

- [ ] **Step 7: Implement minimal `app.ts` + entry**

`apps/api/src/app.ts`:

```ts
import { Hono } from 'hono';

export type AppConfig = {
  anthropicKey: string;
  rateLimitPerHour: number;
  rateLimitPerDay: number;
  allowedOrigins: string[];
};

export const buildApp = (_config: AppConfig) => {
  const app = new Hono();
  app.get('/api/health', (c) => c.json({ ok: true }));
  return app;
};
```

`apps/api/src/index.ts`:

```ts
import { serve } from '@hono/node-server';
import { buildApp } from './app.js';

const requireEnv = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
};

const app = buildApp({
  anthropicKey: requireEnv('ANTHROPIC_API_KEY'),
  rateLimitPerHour: Number(process.env.RATE_LIMIT_PER_HOUR ?? 20),
  rateLimitPerDay: Number(process.env.RATE_LIMIT_PER_DAY ?? 50),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(','),
});

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port });
console.log(`api listening on http://localhost:${port}`);
```

`apps/api/.env.example`:

```
ANTHROPIC_API_KEY=sk-ant-...
RATE_LIMIT_PER_HOUR=20
RATE_LIMIT_PER_DAY=50
ALLOWED_ORIGINS=http://localhost:5173
PORT=8787
```

- [ ] **Step 8: Run — expect pass**

Run: `pnpm --filter @lector/api test`

- [ ] **Step 9: Commit**

```bash
git add apps/api
git commit -m "feat(api): scaffold with health endpoint"
```

---

## Task 8: Rate-limit middleware

**Files:**
- Create: `apps/api/src/middleware/rate-limit.ts`
- Create: `apps/api/src/middleware/rate-limit.test.ts`

The middleware maintains two in-memory counters: per-IP (hourly window) and per-session cookie (daily window). It exposes a `resetStore()` for tests. Sessions are stored in the cookie `lector_session` as a cheap random id; if absent, one is set by the middleware.

- [ ] **Step 1: Write failing test**

`apps/api/src/middleware/rate-limit.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { rateLimit, resetRateLimitStore } from './rate-limit.js';

const build = (perHour = 3, perDay = 5) => {
  const app = new Hono();
  app.use('/api/translate', rateLimit({ perHour, perDay }));
  app.post('/api/translate', (c) => c.json({ ok: true }));
  return app;
};

const req = (app: ReturnType<typeof build>, ip = '1.2.3.4', cookie?: string) =>
  app.request('/api/translate', {
    method: 'POST',
    headers: {
      'x-forwarded-for': ip,
      ...(cookie ? { cookie } : {}),
    },
  });

describe('rateLimit middleware', () => {
  beforeEach(() => resetRateLimitStore());

  it('sets a session cookie on first request when absent', async () => {
    const app = build();
    const res = await req(app);
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toMatch(/lector_session=/);
  });

  it('allows up to perHour requests from one IP', async () => {
    const app = build(3, 100);
    for (let i = 0; i < 3; i++) {
      const res = await req(app);
      expect(res.status).toBe(200);
    }
  });

  it('returns 429 when IP exceeds perHour', async () => {
    const app = build(2, 100);
    await req(app);
    await req(app);
    const res = await req(app);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('rate_limited');
    expect(body.retryAfter).toBeGreaterThan(0);
  });

  it('returns 429 when session exceeds perDay', async () => {
    const app = build(100, 2);
    const r1 = await req(app, '1.1.1.1');
    const cookie = r1.headers.get('set-cookie')?.split(';')[0] ?? '';
    await req(app, '2.2.2.2', cookie);
    const res = await req(app, '3.3.3.3', cookie);
    expect(res.status).toBe(429);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `pnpm --filter @lector/api test`

- [ ] **Step 3: Implement middleware**

`apps/api/src/middleware/rate-limit.ts`:

```ts
import type { MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';

type Counter = { count: number; windowStart: number };
const ipStore = new Map<string, Counter>();
const sessionStore = new Map<string, Counter>();

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const bump = (
  store: Map<string, Counter>,
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfter: number } => {
  const now = Date.now();
  const existing = store.get(key);
  if (!existing || now - existing.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfter: 0 };
  }
  if (existing.count >= limit) {
    const retryAfter = Math.ceil((windowMs - (now - existing.windowStart)) / 1000);
    return { allowed: false, retryAfter };
  }
  existing.count += 1;
  return { allowed: true, retryAfter: 0 };
};

export const resetRateLimitStore = () => {
  ipStore.clear();
  sessionStore.clear();
};

const randomId = () =>
  globalThis.crypto.randomUUID?.() ??
  Math.random().toString(36).slice(2) + Date.now().toString(36);

export const rateLimit = (opts: { perHour: number; perDay: number }): MiddlewareHandler => {
  return async (c, next) => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('x-real-ip') ??
      'unknown';

    let session = getCookie(c, 'lector_session');
    if (!session) {
      session = randomId();
      setCookie(c, 'lector_session', session, {
        httpOnly: true,
        sameSite: 'Lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    const ipCheck = bump(ipStore, ip, opts.perHour, HOUR_MS);
    if (!ipCheck.allowed) {
      return c.json(
        { error: 'rate_limited', retryAfter: ipCheck.retryAfter },
        429,
      );
    }

    const sessionCheck = bump(sessionStore, session, opts.perDay, DAY_MS);
    if (!sessionCheck.allowed) {
      return c.json(
        { error: 'rate_limited', retryAfter: sessionCheck.retryAfter },
        429,
      );
    }

    await next();
  };
};
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): rate-limit middleware (per-IP hourly + per-session daily)"
```

---

## Task 9: Anthropic service abstraction

**Files:**
- Create: `apps/api/src/anthropic.ts`
- Create: `apps/api/src/anthropic.test.ts`

The service wraps the SDK call, extracts text from content blocks, and parses JSON. It also handles the one-retry-on-Zod-failure path.

- [ ] **Step 1: Write failing test**

`apps/api/src/anthropic.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { translateWithRetry } from './anthropic.js';
import type { Anthropic } from '@anthropic-ai/sdk';

const mockClient = (
  responses: string[],
): Pick<Anthropic['messages'], 'create'> & { create: ReturnType<typeof vi.fn> } => {
  const create = vi.fn();
  for (const r of responses) {
    create.mockResolvedValueOnce({
      content: [{ type: 'text', text: r }],
    });
  }
  return { create } as never;
};

const buildMockAnthropic = (responses: string[]) =>
  ({ messages: mockClient(responses) }) as unknown as Anthropic;

describe('translateWithRetry', () => {
  it('returns parsed JSON on first valid response', async () => {
    const client = buildMockAnthropic([
      JSON.stringify({ translation: 'the house', lemma: 'casa' }),
    ]);
    const result = await translateWithRetry(client, {
      systemPrompt: 'sp',
      userPrompt: 'up',
      model: 'claude-haiku-4-5',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.result.translation).toBe('the house');
  });

  it('retries once when the first response fails Zod', async () => {
    const client = buildMockAnthropic([
      'not json',
      JSON.stringify({ translation: 'the house' }),
    ]);
    const result = await translateWithRetry(client, {
      systemPrompt: 'sp',
      userPrompt: 'up',
      model: 'claude-haiku-4-5',
    });
    expect(result.ok).toBe(true);
  });

  it('returns err after both attempts fail', async () => {
    const client = buildMockAnthropic(['not json', 'still not json']);
    const result = await translateWithRetry(client, {
      systemPrompt: 'sp',
      userPrompt: 'up',
      model: 'claude-haiku-4-5',
    });
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect failure**

- [ ] **Step 3: Implement**

`apps/api/src/anthropic.ts`:

```ts
import type { Anthropic } from '@anthropic-ai/sdk';
import { LLMTranslationSchema, type TranslateResponse, ok, err, type Result } from '@lector/shared';

export const DEFAULT_MODEL = 'claude-haiku-4-5';

type TranslateArgs = {
  systemPrompt: string;
  userPrompt: string;
  model: string;
};

const extractText = (resp: Awaited<ReturnType<Anthropic['messages']['create']>>): string => {
  const block = Array.isArray(resp.content) ? resp.content[0] : null;
  if (!block || block.type !== 'text') return '';
  return block.text;
};

const tryParse = (raw: string) => {
  try {
    const json = JSON.parse(raw);
    return LLMTranslationSchema.safeParse(json);
  } catch {
    return { success: false as const, error: new Error('non-json') };
  }
};

export const translateWithRetry = async (
  client: Anthropic,
  args: TranslateArgs,
): Promise<Result<TranslateResponse, { reason: string; rawResponse: string }>> => {
  const start = Date.now();

  const first = await client.messages.create({
    model: args.model,
    max_tokens: 1024,
    system: args.systemPrompt,
    messages: [{ role: 'user', content: args.userPrompt }],
  });
  const firstText = extractText(first);
  const firstParsed = tryParse(firstText);
  if (firstParsed.success) {
    return ok({
      result: firstParsed.data,
      metadata: { latencyMs: Date.now() - start, model: args.model },
    });
  }

  const correction = `Your previous response did not parse as the required JSON object. Respond again with ONLY a valid JSON object matching the schema in the system prompt. Previous response was: ${firstText.slice(0, 500)}`;
  const second = await client.messages.create({
    model: args.model,
    max_tokens: 1024,
    system: args.systemPrompt,
    messages: [{ role: 'user', content: args.userPrompt + '\n\n' + correction }],
  });
  const secondText = extractText(second);
  const secondParsed = tryParse(secondText);
  if (secondParsed.success) {
    return ok({
      result: secondParsed.data,
      metadata: { latencyMs: Date.now() - start, model: args.model },
    });
  }

  return err({ reason: 'zod_failed_after_retry', rawResponse: secondText });
};
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): anthropic call wrapper with zod retry"
```

---

## Task 10: `/api/translate` endpoint

**Files:**
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/src/routes/translate.ts`
- Create: `apps/api/src/routes/translate.test.ts`

- [ ] **Step 1: Write failing test**

`apps/api/src/routes/translate.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { resetRateLimitStore } from '../middleware/rate-limit.js';
import * as anthropicModule from '../anthropic.js';
import { ok } from '@lector/shared';

const makeApp = () =>
  buildApp({
    anthropicKey: 'test',
    rateLimitPerHour: 100,
    rateLimitPerDay: 100,
    allowedOrigins: ['http://localhost:5173'],
  });

const validBody = {
  text: 'caminaba',
  context: 'El hombre caminaba por la calle.',
  sourceLang: 'es',
  targetLang: 'en',
  promptId: 'es-basic',
};

const post = (app: ReturnType<typeof makeApp>, body: unknown) =>
  app.request('/api/translate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.1.1.1' },
    body: JSON.stringify(body),
  });

describe('POST /api/translate', () => {
  beforeEach(() => {
    resetRateLimitStore();
    vi.restoreAllMocks();
  });

  it('returns 400 on invalid body', async () => {
    const app = makeApp();
    const res = await post(app, { text: '' });
    expect(res.status).toBe(400);
  });

  it('returns 200 and validated response on happy path', async () => {
    const spy = vi.spyOn(anthropicModule, 'translateWithRetry').mockResolvedValueOnce(
      ok({
        result: { translation: 'he was walking', lemma: 'caminar' },
        metadata: { latencyMs: 100, model: 'claude-haiku-4-5' },
      }),
    );
    const app = makeApp();
    const res = await post(app, validBody);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.translation).toBe('he was walking');
    expect(spy).toHaveBeenCalled();
  });

  it('returns 502 on upstream failure', async () => {
    vi.spyOn(anthropicModule, 'translateWithRetry').mockRejectedValueOnce(
      new Error('anthropic down'),
    );
    const app = makeApp();
    const res = await post(app, validBody);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('upstream_error');
  });
});
```

- [ ] **Step 2: Run — expect failure**

- [ ] **Step 3: Implement route**

`apps/api/src/routes/translate.ts`:

```ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import Anthropic from '@anthropic-ai/sdk';
import {
  TranslateRequestSchema,
  esBasicPrompt,
  isErr,
} from '@lector/shared';
import { DEFAULT_MODEL, translateWithRetry } from '../anthropic.js';
import type { AppConfig } from '../app.js';

const renderPrompt = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');

export const buildTranslateRoute = (config: AppConfig) => {
  const client = new Anthropic({ apiKey: config.anthropicKey });
  const app = new Hono();

  app.post('/', zValidator('json', TranslateRequestSchema), async (c) => {
    const body = c.req.valid('json');
    if (body.promptId !== esBasicPrompt.id) {
      return c.json({ error: 'bad_request', message: 'unknown promptId' }, 400);
    }

    const systemPrompt = renderPrompt(esBasicPrompt.systemPrompt, {
      selectedText: body.text,
      surroundingContext: body.context,
      sourceLanguage: body.sourceLang,
      targetLanguage: body.targetLang,
    });

    try {
      const result = await translateWithRetry(client, {
        systemPrompt,
        userPrompt: `Translate "${body.text}" in the given context.`,
        model: DEFAULT_MODEL,
      });
      if (isErr(result)) {
        return c.json(
          { error: 'upstream_error', message: result.error.reason },
          502,
        );
      }
      return c.json(result.value);
    } catch (e) {
      return c.json(
        { error: 'upstream_error', message: (e as Error).message },
        502,
      );
    }
  });

  return app;
};
```

- [ ] **Step 4: Modify `app.ts` to mount the route and apply rate limit**

`apps/api/src/app.ts`:

```ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { rateLimit } from './middleware/rate-limit.js';
import { buildTranslateRoute } from './routes/translate.js';

export type AppConfig = {
  anthropicKey: string;
  rateLimitPerHour: number;
  rateLimitPerDay: number;
  allowedOrigins: string[];
};

export const buildApp = (config: AppConfig) => {
  const app = new Hono();

  app.use(
    '*',
    cors({
      origin: (origin) =>
        config.allowedOrigins.includes(origin ?? '') ? (origin ?? null) : null,
      credentials: true,
    }),
  );

  app.get('/api/health', (c) => c.json({ ok: true }));

  app.use(
    '/api/translate',
    rateLimit({ perHour: config.rateLimitPerHour, perDay: config.rateLimitPerDay }),
  );

  app.route('/api/translate', buildTranslateRoute(config));

  app.onError((err, c) => {
    console.error('unhandled error', err);
    return c.json({ error: 'internal', message: err.message }, 500);
  });

  return app;
};
```

- [ ] **Step 5: Run — expect pass**

Run: `pnpm --filter @lector/api test`

- [ ] **Step 6: Commit**

```bash
git add apps/api
git commit -m "feat(api): /api/translate with rate limit, CORS, error envelope"
```

---

## Task 11: Deploy config — Dockerfile + fly.toml

**Files:**
- Create: `apps/api/Dockerfile`
- Create: `apps/api/.dockerignore`
- Create: `apps/api/fly.toml`

- [ ] **Step 1: Write `apps/api/Dockerfile`**

```Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile --filter @lector/api...
RUN pnpm --filter @lector/api build

FROM node:20-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/api/dist ./apps/api/dist
RUN pnpm install --frozen-lockfile --prod --filter @lector/api...
ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787
CMD ["node", "apps/api/dist/index.js"]
```

- [ ] **Step 2: Write `apps/api/.dockerignore`**

```
node_modules
dist
coverage
.env
.env.local
```

- [ ] **Step 3: Write `apps/api/fly.toml`**

```toml
app = "lector-api"
primary_region = "sjc"

[build]
  dockerfile = "apps/api/Dockerfile"

[env]
  PORT = "8787"
  RATE_LIMIT_PER_HOUR = "20"
  RATE_LIMIT_PER_DAY = "50"

[[services]]
  protocol = "tcp"
  internal_port = 8787
  processes = ["app"]

  [[services.ports]]
    port = 80
    handlers = ["http"]
    force_https = true

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [services.concurrency]
    type = "connections"
    hard_limit = 25
    soft_limit = 20

[[services.tcp_checks]]
  interval = "15s"
  timeout = "2s"

[metrics]
  port = 9091
  path = "/metrics"
```

- [ ] **Step 4: Build verification (local)**

Run: `docker build -f apps/api/Dockerfile -t lector-api . && docker run --rm -e ANTHROPIC_API_KEY=test -e ALLOWED_ORIGINS=http://localhost:5173 -p 8787:8787 lector-api &` then `curl http://localhost:8787/api/health` — expect `{"ok":true}`. Stop the container.

(Docker optional at this stage if you don't have it locally; Fly will build in CI.)

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "chore(api): Dockerfile and fly.toml"
```

---

# Phase C — Frontend scaffold + storage

## Task 12: Scaffold `apps/web`

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tsconfig.node.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/App.test.tsx`
- Create: `apps/web/src/index.css`
- Create: `apps/web/src/test-setup.ts`
- Create: `apps/web/src/lib/utils.ts`
- Create: `apps/web/.env.example`

- [ ] **Step 1: Write `apps/web/package.json`**

```json
{
  "name": "@lector/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.32.1",
    "@lector/shared": "workspace:*",
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-popover": "^1.1.2",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-switch": "^1.1.1",
    "@sqlite.org/sqlite-wasm": "^3.46.1-build4",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "drizzle-orm": "^0.35.0",
    "lucide-react": "^0.446.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2",
    "sonner": "^1.5.0",
    "tailwind-merge": "^2.5.2",
    "tailwindcss-animate": "^1.0.7",
    "zod": "^3.23.8",
    "zustand": "^4.5.5"
  },
  "devDependencies": {
    "@testing-library/dom": "^10.4.0",
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.2",
    "autoprefixer": "^10.4.20",
    "drizzle-kit": "^0.26.0",
    "fake-indexeddb": "^6.0.0",
    "jsdom": "^25.0.1",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13",
    "typescript": "^5.6.2",
    "vite": "^5.4.8",
    "vitest": "^2.1.2"
  }
}
```

- [ ] **Step 2: Write `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["vite/client"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Write `apps/web/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts", "vitest.config.ts", "tailwind.config.ts"]
}
```

- [ ] **Step 4: Write `apps/web/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  worker: { format: 'es' },
  server: { port: 5173 },
});
```

- [ ] **Step 5: Write `apps/web/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

- [ ] **Step 6: Write `apps/web/postcss.config.js`**

```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 7: Write `apps/web/tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [animate],
} satisfies Config;
```

- [ ] **Step 8: Write `apps/web/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Lector</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 9: Write `apps/web/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root {
  height: 100%;
}
body {
  font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}
```

- [ ] **Step 10: Write `apps/web/src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
```

- [ ] **Step 11: Write `apps/web/src/test-setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 12: Write failing test for App**

`apps/web/src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { App } from './App.js';
import { MemoryRouter } from 'react-router-dom';

describe('App', () => {
  it('renders a heading', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /lector/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 13: Implement minimal App**

`apps/web/src/App.tsx`:

```tsx
export const App = () => (
  <div className="min-h-screen p-8">
    <h1 className="text-2xl font-semibold">Lector</h1>
  </div>
);
```

`apps/web/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
```

`apps/web/.env.example`:

```
VITE_API_BASE_URL=http://localhost:8787
```

- [ ] **Step 14: Install and run tests**

Run: `pnpm install`
Run: `pnpm --filter @lector/web test`
Expected: App renders test passes.

- [ ] **Step 15: Install shadcn primitives manually**

Create `apps/web/src/components/ui/button.tsx`, `popover.tsx`, `dialog.tsx`, `input.tsx`, `textarea.tsx`, `switch.tsx`, `label.tsx`. Use the stock shadcn/ui New York variant source for each. (Canonical source: `pnpm dlx shadcn@latest add button popover dialog input textarea switch label` with the shadcn `components.json` below.)

`apps/web/components.json`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/index.css",
    "baseColor": "zinc",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

Run: `cd apps/web && pnpm dlx shadcn@latest add button popover dialog input textarea switch label`
This generates the component files under `apps/web/src/components/ui/` and updates `src/index.css` with CSS variables.

- [ ] **Step 16: Commit**

```bash
git add apps/web
git commit -m "feat(web): vite+react+tailwind+shadcn scaffold"
```

---

## Task 13: SQLite worker + OPFS bootstrap

**Files:**
- Create: `apps/web/src/services/db/worker.ts`
- Create: `apps/web/src/services/db/client.ts`
- Create: `apps/web/src/services/db/client.test.ts`

The SQLite-wasm library runs SQLite in a Web Worker with OPFS-backed persistence. The main thread talks to the worker via a small request/response protocol.

- [ ] **Step 1: Write the worker**

`apps/web/src/services/db/worker.ts`:

```ts
/// <reference lib="webworker" />
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

type OpenMsg = { type: 'open'; filename: string };
type ExecMsg = { type: 'exec'; sql: string; bind?: unknown[] };
type QueryMsg = { type: 'query'; sql: string; bind?: unknown[]; id: string };
type Msg = OpenMsg | ExecMsg | QueryMsg;

let db: any = null;

self.onmessage = async (ev: MessageEvent<Msg>) => {
  const msg = ev.data;
  try {
    if (msg.type === 'open') {
      const sqlite3 = await sqlite3InitModule({ print: () => {}, printErr: () => {} });
      db = new sqlite3.oo1.OpfsDb(msg.filename);
      self.postMessage({ type: 'opened' });
      return;
    }
    if (!db) throw new Error('db not opened');
    if (msg.type === 'exec') {
      db.exec({ sql: msg.sql, bind: msg.bind ?? [] });
      return;
    }
    if (msg.type === 'query') {
      const rows: Record<string, unknown>[] = [];
      db.exec({
        sql: msg.sql,
        bind: msg.bind ?? [],
        rowMode: 'object',
        callback: (r: Record<string, unknown>) => {
          rows.push(r);
        },
      });
      self.postMessage({ type: 'result', id: msg.id, rows });
    }
  } catch (e) {
    self.postMessage({
      type: 'error',
      id: 'id' in msg ? msg.id : undefined,
      message: (e as Error).message,
    });
  }
};
```

- [ ] **Step 2: Write failing test for `client`**

`apps/web/src/services/db/client.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createDbClient, type DbClient } from './client.js';

describe('DbClient', () => {
  let db: DbClient;

  beforeEach(async () => {
    db = await createDbClient({ mode: 'memory' });
  });

  it('executes a DDL statement', async () => {
    await db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT);');
    await db.exec("INSERT INTO t (name) VALUES ('a');");
    const rows = await db.query<{ id: number; name: string }>('SELECT id, name FROM t;');
    expect(rows).toEqual([{ id: 1, name: 'a' }]);
  });
});
```

- [ ] **Step 3: Implement `client.ts` with a memory-backed fallback for tests**

`apps/web/src/services/db/client.ts`:

```ts
export type DbClient = {
  exec: (sql: string, bind?: unknown[]) => Promise<void>;
  query: <T = Record<string, unknown>>(sql: string, bind?: unknown[]) => Promise<T[]>;
  close: () => Promise<void>;
};

type ClientOpts = { mode: 'opfs'; filename: string } | { mode: 'memory' };

const createWorkerClient = (filename: string): Promise<DbClient> =>
  new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    const pending = new Map<string, { res: (rows: any[]) => void; rej: (e: Error) => void }>();

    worker.addEventListener('message', (ev: MessageEvent<any>) => {
      const data = ev.data;
      if (data.type === 'opened') {
        resolve({
          exec: (sql, bind) =>
            new Promise((r) => {
              worker.postMessage({ type: 'exec', sql, bind });
              queueMicrotask(() => r());
            }),
          query: (sql, bind) =>
            new Promise((res, rej) => {
              const id = crypto.randomUUID();
              pending.set(id, { res, rej });
              worker.postMessage({ type: 'query', sql, bind, id });
            }),
          close: async () => worker.terminate(),
        });
      }
      if (data.type === 'result') {
        pending.get(data.id)?.res(data.rows);
        pending.delete(data.id);
      }
      if (data.type === 'error') {
        if (data.id) {
          pending.get(data.id)?.rej(new Error(data.message));
          pending.delete(data.id);
        } else {
          reject(new Error(data.message));
        }
      }
    });

    worker.postMessage({ type: 'open', filename });
  });

const createMemoryClient = async (): Promise<DbClient> => {
  const sqlite3InitModule = (await import('@sqlite.org/sqlite-wasm')).default;
  const sqlite3 = await sqlite3InitModule({ print: () => {}, printErr: () => {} });
  const db = new sqlite3.oo1.DB(':memory:', 'ct');

  return {
    exec: async (sql, bind) => {
      db.exec({ sql, bind: bind ?? [] });
    },
    query: async <T>(sql: string, bind?: unknown[]) => {
      const rows: T[] = [];
      db.exec({
        sql,
        bind: bind ?? [],
        rowMode: 'object',
        callback: (r: T) => rows.push(r),
      });
      return rows;
    },
    close: async () => db.close(),
  };
};

export const createDbClient = async (opts: ClientOpts): Promise<DbClient> => {
  if (opts.mode === 'memory') return createMemoryClient();
  return createWorkerClient(opts.filename);
};
```

- [ ] **Step 4: Run — expect pass**

Run: `pnpm --filter @lector/web test src/services/db/client`
Expected: pass.

Note: if sqlite-wasm node loading fails in jsdom, ensure vitest's `environment` is `jsdom` (already set) and the package's node-friendly loader is used. If it still fails in tests, mark this test as `.skip` and rely on the repository tests (next tasks) using the memory client.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): sqlite worker + opfs client"
```

---

## Task 14: Drizzle schema + migrations

**Files:**
- Create: `apps/web/drizzle.config.ts`
- Create: `apps/web/src/services/db/schema.ts`
- Create: `apps/web/src/services/db/migrations.ts`
- Create: `apps/web/src/services/db/migrations.test.ts`
- Create: `apps/web/src/services/db/migrations/0000_init.sql` (generated)

Drizzle generates SQL migrations; we keep them checked in. The runner applies them in order using the DbClient.

- [ ] **Step 1: Write `apps/web/drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/services/db/schema.ts',
  out: './src/services/db/migrations',
  dialect: 'sqlite',
});
```

- [ ] **Step 2: Write schema**

`apps/web/src/services/db/schema.ts`:

```ts
import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const lookups = sqliteTable(
  'lookups',
  {
    id: text('id').primaryKey(),
    timestamp: integer('timestamp').notNull(),
    sourceText: text('source_text').notNull(),
    sourceLang: text('source_lang').notNull(),
    translation: text('translation').notNull(),
    context: text('context').notNull().default(''),
    articleId: text('article_id'),
    provider: text('provider', { enum: ['wiktionary', 'anthropic'] }).notNull(),
    promptId: text('prompt_id'),
    tier: text('tier', { enum: ['dictionary', 'llm'] }).notNull(),
    rawResponse: text('raw_response').notNull().default(''),
  },
  (t) => ({
    tsIdx: index('lookups_timestamp_idx').on(t.timestamp),
  }),
);

export const vocabItems = sqliteTable(
  'vocab_items',
  {
    id: text('id').primaryKey(),
    lemma: text('lemma').notNull(),
    language: text('language').notNull(),
    firstSeenAt: integer('first_seen_at').notNull(),
    lookupCount: integer('lookup_count').notNull().default(0),
    lastSeenAt: integer('last_seen_at').notNull(),
    userNotes: text('user_notes').notNull().default(''),
    tags: text('tags').notNull().default('[]'),
    exportedToAnki: integer('exported_to_anki', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => ({
    lemmaLangUniq: uniqueIndex('vocab_lemma_lang_uniq').on(t.lemma, t.language),
    expoIdx: index('vocab_exported_idx').on(t.exportedToAnki),
  }),
);

export const articles = sqliteTable('articles', {
  id: text('id').primaryKey(),
  url: text('url'),
  title: text('title').notNull().default(''),
  rawText: text('raw_text').notNull(),
  language: text('language').notNull(),
  addedAt: integer('added_at').notNull(),
});

export const prompts = sqliteTable('prompts', {
  id: text('id').primaryKey(),
  language: text('language').notNull(),
  name: text('name').notNull(),
  systemPrompt: text('system_prompt').notNull(),
  builtIn: integer('built_in', { mode: 'boolean' }).notNull().default(false),
  version: integer('version').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
```

- [ ] **Step 3: Generate first migration**

Run: `pnpm --filter @lector/web db:generate`
Expected: creates `apps/web/src/services/db/migrations/0000_init.sql` and a `meta/_journal.json`.

- [ ] **Step 4: Hand-edit the migration to append FTS5 virtual tables**

Append to `apps/web/src/services/db/migrations/0000_init.sql`:

```sql
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
```

- [ ] **Step 5: Write failing test for `migrations.ts`**

`apps/web/src/services/db/migrations.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createDbClient } from './client.js';
import { runMigrations } from './migrations.js';

describe('runMigrations', () => {
  it('creates all expected tables', async () => {
    const db = await createDbClient({ mode: 'memory' });
    await runMigrations(db);
    const tables = await db.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;",
    );
    const names = tables.map((t) => t.name);
    expect(names).toContain('lookups');
    expect(names).toContain('vocab_items');
    expect(names).toContain('articles');
    expect(names).toContain('prompts');
    expect(names).toContain('vocab_notes_fts');
    expect(names).toContain('lookup_context_fts');
  });

  it('is idempotent (second run is a no-op)', async () => {
    const db = await createDbClient({ mode: 'memory' });
    await runMigrations(db);
    await runMigrations(db);
    const rows = await db.query('SELECT 1 AS one FROM lookups LIMIT 1;');
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 6: Run — expect failure**

- [ ] **Step 7: Implement migrations runner**

`apps/web/src/services/db/migrations.ts`:

```ts
import init0000 from './migrations/0000_init.sql?raw';
import type { DbClient } from './client.js';

const migrations: { id: number; sql: string }[] = [
  { id: 0, sql: init0000 },
];

const ensureMigrationTable = async (db: DbClient) => {
  await db.exec(
    'CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);',
  );
};

const applied = async (db: DbClient): Promise<Set<number>> => {
  const rows = await db.query<{ id: number }>('SELECT id FROM _migrations;');
  return new Set(rows.map((r) => r.id));
};

export const runMigrations = async (db: DbClient): Promise<void> => {
  await ensureMigrationTable(db);
  const done = await applied(db);
  for (const m of migrations) {
    if (done.has(m.id)) continue;
    for (const stmt of m.sql.split('--> statement-breakpoint')) {
      const s = stmt.trim();
      if (s) await db.exec(s);
    }
    await db.exec('INSERT INTO _migrations (id, applied_at) VALUES (?, ?);', [
      m.id,
      Date.now(),
    ]);
  }
};
```

(Note: Vite's `?raw` import needs no extra config; ensure `vite/client` types include it — already via `"types": ["vite/client"]`.)

- [ ] **Step 8: Run — expect pass**

- [ ] **Step 9: Commit**

```bash
git add apps/web
git commit -m "feat(web): drizzle schema + migrations with FTS5"
```

---

## Task 15: Lookups repository

**Files:**
- Create: `apps/web/src/services/db/repositories/lookups.ts`
- Create: `apps/web/src/services/db/repositories/lookups.test.ts`

- [ ] **Step 1: Write failing test**

`apps/web/src/services/db/repositories/lookups.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createDbClient, type DbClient } from '../client.js';
import { runMigrations } from '../migrations.js';
import { createLookupsRepo } from './lookups.js';

describe('lookupsRepo', () => {
  let db: DbClient;
  beforeEach(async () => {
    db = await createDbClient({ mode: 'memory' });
    await runMigrations(db);
  });

  it('inserts and lists', async () => {
    const repo = createLookupsRepo(db);
    const row = await repo.insert({
      sourceText: 'caminaba',
      sourceLang: 'es',
      translation: 'he was walking',
      context: 'El hombre caminaba.',
      articleId: null,
      provider: 'anthropic',
      promptId: 'es-basic',
      tier: 'llm',
      rawResponse: '{"translation":"he was walking"}',
    });
    expect(row.id).toBeTruthy();
    expect(row.timestamp).toBeGreaterThan(0);

    const all = await repo.list();
    expect(all).toHaveLength(1);
    expect(all[0]?.sourceText).toBe('caminaba');
  });
});
```

- [ ] **Step 2: Run — expect failure**

- [ ] **Step 3: Implement repository**

`apps/web/src/services/db/repositories/lookups.ts`:

```ts
import type { DbClient } from '../client.js';
import type { LookupRow } from '@lector/shared';

type InsertInput = Omit<LookupRow, 'id' | 'timestamp'>;

const rowFromDb = (r: Record<string, unknown>): LookupRow => ({
  id: r.id as string,
  timestamp: r.timestamp as number,
  sourceText: r.source_text as string,
  sourceLang: r.source_lang as string,
  translation: r.translation as string,
  context: r.context as string,
  articleId: (r.article_id as string | null) ?? null,
  provider: r.provider as 'wiktionary' | 'anthropic',
  promptId: (r.prompt_id as string | null) ?? null,
  tier: r.tier as 'dictionary' | 'llm',
  rawResponse: r.raw_response as string,
});

export const createLookupsRepo = (db: DbClient) => ({
  insert: async (input: InsertInput): Promise<LookupRow> => {
    const id = crypto.randomUUID();
    const timestamp = Date.now();
    await db.exec(
      `INSERT INTO lookups (id, timestamp, source_text, source_lang, translation, context, article_id, provider, prompt_id, tier, raw_response)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        timestamp,
        input.sourceText,
        input.sourceLang,
        input.translation,
        input.context,
        input.articleId,
        input.provider,
        input.promptId,
        input.tier,
        input.rawResponse,
      ],
    );
    return { id, timestamp, ...input };
  },

  list: async (): Promise<LookupRow[]> => {
    const rows = await db.query('SELECT * FROM lookups ORDER BY timestamp DESC;');
    return rows.map(rowFromDb);
  },
});

export type LookupsRepo = ReturnType<typeof createLookupsRepo>;
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web/db): lookups repository"
```

---

## Task 16: VocabItems repository (with upsert)

**Files:**
- Create: `apps/web/src/services/db/repositories/vocab-items.ts`
- Create: `apps/web/src/services/db/repositories/vocab-items.test.ts`

- [ ] **Step 1: Write failing test**

`apps/web/src/services/db/repositories/vocab-items.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createDbClient, type DbClient } from '../client.js';
import { runMigrations } from '../migrations.js';
import { createVocabItemsRepo } from './vocab-items.js';

describe('vocabItemsRepo', () => {
  let db: DbClient;
  beforeEach(async () => {
    db = await createDbClient({ mode: 'memory' });
    await runMigrations(db);
  });

  it('upsert inserts on first call', async () => {
    const repo = createVocabItemsRepo(db);
    const row = await repo.upsert({ lemma: 'caminar', language: 'es' });
    expect(row.lemma).toBe('caminar');
    expect(row.lookupCount).toBe(1);
    expect(row.firstSeenAt).toBeGreaterThan(0);
    expect(row.lastSeenAt).toBe(row.firstSeenAt);
  });

  it('upsert increments on second call and updates lastSeenAt', async () => {
    const repo = createVocabItemsRepo(db);
    const first = await repo.upsert({ lemma: 'caminar', language: 'es' });
    await new Promise((r) => setTimeout(r, 5));
    const second = await repo.upsert({ lemma: 'caminar', language: 'es' });
    expect(second.id).toBe(first.id);
    expect(second.lookupCount).toBe(2);
    expect(second.lastSeenAt).toBeGreaterThanOrEqual(first.lastSeenAt);
  });

  it('treats (lemma, language) as unique', async () => {
    const repo = createVocabItemsRepo(db);
    const es = await repo.upsert({ lemma: 'casa', language: 'es' });
    const pt = await repo.upsert({ lemma: 'casa', language: 'pt' });
    expect(es.id).not.toBe(pt.id);
  });
});
```

- [ ] **Step 2: Run — expect failure**

- [ ] **Step 3: Implement**

`apps/web/src/services/db/repositories/vocab-items.ts`:

```ts
import type { DbClient } from '../client.js';
import type { VocabItemRow } from '@lector/shared';

const rowFromDb = (r: Record<string, unknown>): VocabItemRow => ({
  id: r.id as string,
  lemma: r.lemma as string,
  language: r.language as string,
  firstSeenAt: r.first_seen_at as number,
  lookupCount: r.lookup_count as number,
  lastSeenAt: r.last_seen_at as number,
  userNotes: r.user_notes as string,
  tags: JSON.parse((r.tags as string) ?? '[]') as string[],
  exportedToAnki: Boolean(r.exported_to_anki),
});

export const createVocabItemsRepo = (db: DbClient) => ({
  upsert: async (input: { lemma: string; language: string }): Promise<VocabItemRow> => {
    const existing = await db.query(
      'SELECT * FROM vocab_items WHERE lemma = ? AND language = ? LIMIT 1;',
      [input.lemma, input.language],
    );
    const now = Date.now();
    if (existing.length > 0) {
      const row = existing[0]!;
      await db.exec(
        'UPDATE vocab_items SET lookup_count = lookup_count + 1, last_seen_at = ? WHERE id = ?;',
        [now, row.id],
      );
      return rowFromDb({
        ...row,
        lookup_count: (row.lookup_count as number) + 1,
        last_seen_at: now,
      });
    }
    const id = crypto.randomUUID();
    await db.exec(
      `INSERT INTO vocab_items (id, lemma, language, first_seen_at, lookup_count, last_seen_at, user_notes, tags, exported_to_anki)
       VALUES (?, ?, ?, ?, 1, ?, '', '[]', 0);`,
      [id, input.lemma, input.language, now, now],
    );
    return {
      id,
      lemma: input.lemma,
      language: input.language,
      firstSeenAt: now,
      lookupCount: 1,
      lastSeenAt: now,
      userNotes: '',
      tags: [],
      exportedToAnki: false,
    };
  },

  listAll: async (): Promise<VocabItemRow[]> => {
    const rows = await db.query('SELECT * FROM vocab_items ORDER BY last_seen_at DESC;');
    return rows.map(rowFromDb);
  },
});

export type VocabItemsRepo = ReturnType<typeof createVocabItemsRepo>;
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web/db): vocab-items repository with upsert"
```

---

## Task 17: DB provider (lazy singleton) + unit of repositories

**Files:**
- Create: `apps/web/src/services/db/index.ts`

The app grabs a single db instance at boot. The first call creates the OPFS-backed client and runs migrations.

- [ ] **Step 1: Write `apps/web/src/services/db/index.ts`**

```ts
import { createDbClient, type DbClient } from './client.js';
import { runMigrations } from './migrations.js';
import { createLookupsRepo, type LookupsRepo } from './repositories/lookups.js';
import { createVocabItemsRepo, type VocabItemsRepo } from './repositories/vocab-items.js';

export type DbHandle = {
  client: DbClient;
  lookups: LookupsRepo;
  vocabItems: VocabItemsRepo;
};

let handle: DbHandle | null = null;
let booting: Promise<DbHandle> | null = null;

export const getDb = async (): Promise<DbHandle> => {
  if (handle) return handle;
  if (booting) return booting;
  booting = (async () => {
    const client = await createDbClient({ mode: 'opfs', filename: 'lector.sqlite3' });
    await runMigrations(client);
    handle = {
      client,
      lookups: createLookupsRepo(client),
      vocabItems: createVocabItemsRepo(client),
    };
    return handle;
  })();
  return booting;
};

export const resetDbForTests = (): void => {
  handle = null;
  booting = null;
};
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @lector/web typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/web
git commit -m "feat(web/db): db handle singleton with migrations bootstrap"
```

---

# Phase D — Frontend services

## Task 18: Tokenizer

**Files:**
- Create: `apps/web/src/services/text/tokenize.ts`
- Create: `apps/web/src/services/text/tokenize.test.ts`

Tokenizer wraps `Intl.Segmenter` with `granularity: 'word'`. Each token reports its text, offset, and whether it's a word (as opposed to whitespace/punctuation).

- [ ] **Step 1: Write failing test**

`apps/web/src/services/text/tokenize.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { tokenize, sentenceAround } from './tokenize.js';

describe('tokenize (es)', () => {
  it('splits words and preserves punctuation as non-word tokens', () => {
    const tokens = tokenize('¿Cómo estás, amigo?', 'es');
    const words = tokens.filter((t) => t.isWord).map((t) => t.text);
    expect(words).toEqual(['Cómo', 'estás', 'amigo']);
  });

  it('handles diacritics and ñ', () => {
    const tokens = tokenize('La mañana está aquí.', 'es');
    const words = tokens.filter((t) => t.isWord).map((t) => t.text);
    expect(words).toEqual(['La', 'mañana', 'está', 'aquí']);
  });

  it('reports start offsets aligned with source', () => {
    const src = 'Hola mundo.';
    const tokens = tokenize(src, 'es');
    for (const t of tokens) {
      expect(src.slice(t.start, t.start + t.text.length)).toBe(t.text);
    }
  });
});

describe('sentenceAround', () => {
  it('returns the containing sentence for an offset', () => {
    const src = 'Hola amigo. El hombre caminaba por la calle. Hace frío.';
    const s = sentenceAround(src, src.indexOf('caminaba'), 'es');
    expect(s).toBe('El hombre caminaba por la calle.');
  });
});
```

- [ ] **Step 2: Run — expect failure**

- [ ] **Step 3: Implement**

`apps/web/src/services/text/tokenize.ts`:

```ts
export type Token = {
  text: string;
  start: number;
  isWord: boolean;
};

export const tokenize = (text: string, locale = 'es'): Token[] => {
  const seg = new Intl.Segmenter(locale, { granularity: 'word' });
  const tokens: Token[] = [];
  for (const s of seg.segment(text)) {
    tokens.push({ text: s.segment, start: s.index, isWord: Boolean(s.isWordLike) });
  }
  return tokens;
};

export const sentenceAround = (text: string, offset: number, locale = 'es'): string => {
  const seg = new Intl.Segmenter(locale, { granularity: 'sentence' });
  for (const s of seg.segment(text)) {
    const end = s.index + s.segment.length;
    if (offset >= s.index && offset < end) {
      return s.segment.trim();
    }
  }
  return text;
};
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): tokenizer using Intl.Segmenter"
```

---

## Task 19: DictionaryProvider (Wiktionary)

**Files:**
- Create: `apps/web/src/services/providers/types.ts`
- Create: `apps/web/src/services/providers/dictionary.ts`
- Create: `apps/web/src/services/providers/dictionary.test.ts`

Wiktionary returns a nested structure. We extract the first English definition for the first sense, plus the part of speech. Any failure yields an `err`.

- [ ] **Step 1: Write shared provider types**

`apps/web/src/services/providers/types.ts`:

```ts
import type { Result, LLMTranslation } from '@lector/shared';

export type TranslationRequest = {
  text: string;
  context: string;
  sourceLang: 'es';
  targetLang: 'en';
  promptId: string;
};

export type DictionaryResult = {
  translation: string;
  lemma: string;
  partOfSpeech?: string;
};

export type DictionaryError = { reason: 'not_found' | 'network' | 'parse'; detail?: string };
export type LLMError = { reason: 'network' | 'zod' | 'rate_limited' | 'unauthorized' | 'server'; detail?: string };

export type DictionaryProvider = {
  lookup: (req: TranslationRequest) => Promise<Result<DictionaryResult, DictionaryError>>;
};

export type LLMProvider = {
  translate: (req: TranslationRequest) => Promise<Result<{ result: LLMTranslation; rawResponse: string }, LLMError>>;
};
```

- [ ] **Step 2: Write failing test**

`apps/web/src/services/providers/dictionary.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createWiktionaryDictionary } from './dictionary.js';
import { isOk, isErr } from '@lector/shared';

const wiktionaryResponse = {
  en: [
    {
      partOfSpeech: 'Verb',
      language: 'Spanish',
      definitions: [{ definition: 'to walk' }],
    },
  ],
};

describe('WiktionaryDictionary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns translation and part of speech on 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify(wiktionaryResponse), { status: 200 }),
      ),
    );
    const dict = createWiktionaryDictionary();
    const r = await dict.lookup({
      text: 'caminar',
      context: '',
      sourceLang: 'es',
      targetLang: 'en',
      promptId: 'es-basic',
    });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.translation).toBe('to walk');
      expect(r.value.lemma).toBe('caminar');
      expect(r.value.partOfSpeech).toBe('Verb');
    }
  });

  it('returns err not_found on 404', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    const dict = createWiktionaryDictionary();
    const r = await dict.lookup({
      text: 'xyzabc',
      context: '',
      sourceLang: 'es',
      targetLang: 'en',
      promptId: 'es-basic',
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.reason).toBe('not_found');
  });

  it('returns err network on fetch throw', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('offline');
      }),
    );
    const dict = createWiktionaryDictionary();
    const r = await dict.lookup({
      text: 'caminar',
      context: '',
      sourceLang: 'es',
      targetLang: 'en',
      promptId: 'es-basic',
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.reason).toBe('network');
  });
});
```

- [ ] **Step 3: Run — expect failure**

- [ ] **Step 4: Implement**

`apps/web/src/services/providers/dictionary.ts`:

```ts
import { ok, err } from '@lector/shared';
import type { DictionaryProvider } from './types.js';

const WIKI_BASE =
  'https://en.wiktionary.org/api/rest_v1/page/definition/';

const stripHtml = (s: string) =>
  s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

const SOURCE_LANG_NAMES: Record<string, string> = {
  es: 'Spanish',
};

export const createWiktionaryDictionary = (): DictionaryProvider => ({
  lookup: async (req) => {
    try {
      const resp = await fetch(`${WIKI_BASE}${encodeURIComponent(req.text)}`);
      if (resp.status === 404) return err({ reason: 'not_found' });
      if (!resp.ok) return err({ reason: 'network', detail: `status ${resp.status}` });

      const data = (await resp.json()) as Record<string, Array<{
        partOfSpeech?: string;
        language?: string;
        definitions?: Array<{ definition?: string }>;
      }>>;

      const en = data.en ?? [];
      const sourceName = SOURCE_LANG_NAMES[req.sourceLang];
      const match =
        en.find((e) => e.language === sourceName) ?? en[0];

      if (!match) return err({ reason: 'not_found' });
      const defRaw = match.definitions?.[0]?.definition;
      if (!defRaw) return err({ reason: 'not_found' });

      const result: Awaited<ReturnType<DictionaryProvider['lookup']>> = ok({
        translation: stripHtml(defRaw),
        lemma: req.text,
        ...(match.partOfSpeech ? { partOfSpeech: match.partOfSpeech } : {}),
      });
      return result;
    } catch (e) {
      return err({ reason: 'network', detail: (e as Error).message });
    }
  },
});
```

- [ ] **Step 5: Run — expect pass**

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat(web/providers): wiktionary dictionary provider"
```

---

## Task 20: LLM provider (mode-aware)

**Files:**
- Create: `apps/web/src/services/providers/llm.ts`
- Create: `apps/web/src/services/providers/llm.test.ts`

The LLM provider has two code paths: *proxy* (demo mode — `fetch` to backend) and *direct* (BYO-key mode — calls the Anthropic SDK). Which it uses is determined at construction time by a `TranslationMode` + config object.

- [ ] **Step 1: Write failing test**

`apps/web/src/services/providers/llm.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createLLMProvider } from './llm.js';
import { isOk, isErr } from '@lector/shared';

const mockResponse = {
  result: { translation: 'he was walking', lemma: 'caminar' },
  metadata: { latencyMs: 123, model: 'claude-haiku-4-5' },
};

const req = {
  text: 'caminaba',
  context: 'El hombre caminaba por la calle.',
  sourceLang: 'es' as const,
  targetLang: 'en' as const,
  promptId: 'es-basic',
};

describe('LLMProvider', () => {
  afterEach(() => vi.restoreAllMocks());

  describe('proxy mode', () => {
    it('POSTs to /api/translate and returns ok on 200', async () => {
      const fetchMock = vi.fn(async () =>
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      );
      vi.stubGlobal('fetch', fetchMock);
      const p = createLLMProvider({ mode: 'proxy', apiBaseUrl: 'http://api' });
      const r = await p.translate(req);
      expect(isOk(r)).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://api/api/translate',
        expect.objectContaining({ method: 'POST', credentials: 'include' }),
      );
    });

    it('returns rate_limited error on 429', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429 })),
      );
      const p = createLLMProvider({ mode: 'proxy', apiBaseUrl: 'http://api' });
      const r = await p.translate(req);
      expect(isErr(r)).toBe(true);
      if (isErr(r)) expect(r.error.reason).toBe('rate_limited');
    });

    it('returns network error on fetch throw', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new Error('offline');
        }),
      );
      const p = createLLMProvider({ mode: 'proxy', apiBaseUrl: 'http://api' });
      const r = await p.translate(req);
      expect(isErr(r)).toBe(true);
      if (isErr(r)) expect(r.error.reason).toBe('network');
    });
  });
});
```

(We test the *proxy* mode thoroughly because it's the default. The *direct* mode goes through the SDK; we exercise it via a thin mock in an integration context or manually during acceptance.)

- [ ] **Step 2: Run — expect failure**

- [ ] **Step 3: Implement**

`apps/web/src/services/providers/llm.ts`:

```ts
import {
  ok,
  err,
  TranslateResponseSchema,
  LLMTranslationSchema,
  esBasicPrompt,
} from '@lector/shared';
import type { LLMProvider } from './types.js';

export type LLMProviderConfig =
  | { mode: 'proxy'; apiBaseUrl: string }
  | { mode: 'direct'; anthropicKey: string; model?: string };

const DEFAULT_DIRECT_MODEL = 'claude-haiku-4-5';

const renderPrompt = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

const proxy = (baseUrl: string): LLMProvider => ({
  translate: async (req) => {
    let resp: Response;
    try {
      resp = await fetch(`${baseUrl}/api/translate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(req),
      });
    } catch (e) {
      return err({ reason: 'network', detail: (e as Error).message });
    }

    if (resp.status === 429) return err({ reason: 'rate_limited' });
    if (resp.status === 401 || resp.status === 403)
      return err({ reason: 'unauthorized' });
    if (!resp.ok) return err({ reason: 'server', detail: `status ${resp.status}` });

    const json = await resp.json();
    const parsed = TranslateResponseSchema.safeParse(json);
    if (!parsed.success) return err({ reason: 'zod', detail: parsed.error.message });
    return ok({ result: parsed.data.result, rawResponse: JSON.stringify(json) });
  },
});

const direct = (apiKey: string, model: string): LLMProvider => ({
  translate: async (req) => {
    const AnthropicMod = await import('@anthropic-ai/sdk');
    const Anthropic = AnthropicMod.default;
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

    const systemPrompt = renderPrompt(esBasicPrompt.systemPrompt, {
      selectedText: req.text,
      surroundingContext: req.context,
      sourceLanguage: req.sourceLang,
      targetLanguage: req.targetLang,
    });

    const call = async () => {
      const resp = await client.messages.create({
        model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          { role: 'user', content: `Translate "${req.text}" in the given context.` },
        ],
      });
      const block = resp.content[0];
      return block && block.type === 'text' ? block.text : '';
    };

    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const text = await call();
        try {
          const json = JSON.parse(text);
          const parsed = LLMTranslationSchema.safeParse(json);
          if (parsed.success) return ok({ result: parsed.data, rawResponse: text });
        } catch {
          // fall through to retry
        }
      }
      return err({ reason: 'zod' });
    } catch (e) {
      const msg = (e as Error).message ?? '';
      if (/401|403/.test(msg)) return err({ reason: 'unauthorized' });
      if (/429/.test(msg)) return err({ reason: 'rate_limited' });
      return err({ reason: 'network', detail: msg });
    }
  },
});

export const createLLMProvider = (cfg: LLMProviderConfig): LLMProvider => {
  if (cfg.mode === 'proxy') return proxy(cfg.apiBaseUrl);
  return direct(cfg.anthropicKey, cfg.model ?? DEFAULT_DIRECT_MODEL);
};
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web/providers): mode-aware llm provider (proxy + direct)"
```

---

## Task 21: TranslationService

**Files:**
- Create: `apps/web/src/services/translation/translation-service.ts`
- Create: `apps/web/src/services/translation/translation-service.test.ts`

The service is the single entry point: routes by tier, calls the right provider, persists the lookup, upserts vocab, returns a single `Result`.

- [ ] **Step 1: Write failing test**

`apps/web/src/services/translation/translation-service.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createDbClient, type DbClient } from '../db/client.js';
import { runMigrations } from '../db/migrations.js';
import { createLookupsRepo } from '../db/repositories/lookups.js';
import { createVocabItemsRepo } from '../db/repositories/vocab-items.js';
import { createTranslationService } from './translation-service.js';
import { ok, err } from '@lector/shared';
import type { DictionaryProvider, LLMProvider } from '../providers/types.js';

const mkProviders = () => {
  const dict: DictionaryProvider = {
    lookup: async () =>
      ok({ translation: 'house', lemma: 'casa', partOfSpeech: 'Noun' }),
  };
  const llm: LLMProvider = {
    translate: async () =>
      ok({
        result: { translation: 'the house', lemma: 'casa' },
        rawResponse: '{"translation":"the house"}',
      }),
  };
  return { dict, llm };
};

describe('TranslationService', () => {
  let db: DbClient;
  beforeEach(async () => {
    db = await createDbClient({ mode: 'memory' });
    await runMigrations(db);
  });

  it('dictionary tier logs lookup and upserts vocab', async () => {
    const { dict, llm } = mkProviders();
    const svc = createTranslationService({
      dict,
      llm,
      lookups: createLookupsRepo(db),
      vocabItems: createVocabItemsRepo(db),
    });
    const r = await svc.translate({
      text: 'casa',
      context: 'la casa',
      sourceLang: 'es',
      targetLang: 'en',
      promptId: 'es-basic',
      tier: 'dictionary',
    });
    expect(r.ok).toBe(true);
    const lookups = await db.query('SELECT * FROM lookups;');
    expect(lookups).toHaveLength(1);
    const vocab = await db.query('SELECT * FROM vocab_items;');
    expect(vocab).toHaveLength(1);
    expect((vocab[0] as any).lemma).toBe('casa');
  });

  it('llm tier returns structured translation', async () => {
    const { dict, llm } = mkProviders();
    const svc = createTranslationService({
      dict,
      llm,
      lookups: createLookupsRepo(db),
      vocabItems: createVocabItemsRepo(db),
    });
    const r = await svc.translate({
      text: 'la casa roja',
      context: 'Vivo en la casa roja.',
      sourceLang: 'es',
      targetLang: 'en',
      promptId: 'es-basic',
      tier: 'llm',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.tier).toBe('llm');
      expect(r.value.result.translation).toBe('the house');
    }
  });

  it('llm error still surfaces; no lookup row written', async () => {
    const llm: LLMProvider = {
      translate: async () => err({ reason: 'rate_limited' }),
    };
    const svc = createTranslationService({
      dict: mkProviders().dict,
      llm,
      lookups: createLookupsRepo(db),
      vocabItems: createVocabItemsRepo(db),
    });
    const r = await svc.translate({
      text: 'x',
      context: 'x',
      sourceLang: 'es',
      targetLang: 'en',
      promptId: 'es-basic',
      tier: 'llm',
    });
    expect(r.ok).toBe(false);
    const lookups = await db.query('SELECT * FROM lookups;');
    expect(lookups).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run — expect failure**

- [ ] **Step 3: Implement**

`apps/web/src/services/translation/translation-service.ts`:

```ts
import { ok, err, type Result, type LLMTranslation } from '@lector/shared';
import type { DictionaryProvider, LLMProvider, TranslationRequest } from '../providers/types.js';
import type { LookupsRepo } from '../db/repositories/lookups.js';
import type { VocabItemsRepo } from '../db/repositories/vocab-items.js';

export type TierRequest = TranslationRequest & { tier: 'dictionary' | 'llm' };

export type DictionaryTranslation = {
  tier: 'dictionary';
  translation: string;
  lemma: string;
  partOfSpeech?: string;
};

export type LLMTranslationResult = {
  tier: 'llm';
  result: LLMTranslation;
};

export type TranslationResult = DictionaryTranslation | LLMTranslationResult;

export type TranslationError =
  | { reason: 'not_found' }
  | { reason: 'rate_limited' }
  | { reason: 'unauthorized' }
  | { reason: 'network'; detail?: string }
  | { reason: 'server'; detail?: string }
  | { reason: 'zod'; detail?: string };

type Deps = {
  dict: DictionaryProvider;
  llm: LLMProvider;
  lookups: LookupsRepo;
  vocabItems: VocabItemsRepo;
};

export const createTranslationService = (deps: Deps) => ({
  translate: async (
    req: TierRequest,
  ): Promise<Result<TranslationResult, TranslationError>> => {
    if (req.tier === 'dictionary') {
      const r = await deps.dict.lookup(req);
      if (!r.ok) {
        if (r.error.reason === 'not_found') return err({ reason: 'not_found' });
        return err({ reason: 'network', detail: r.error.detail });
      }
      await deps.lookups.insert({
        sourceText: req.text,
        sourceLang: req.sourceLang,
        translation: r.value.translation,
        context: req.context,
        articleId: null,
        provider: 'wiktionary',
        promptId: null,
        tier: 'dictionary',
        rawResponse: JSON.stringify(r.value),
      });
      await deps.vocabItems.upsert({ lemma: r.value.lemma, language: req.sourceLang });
      return ok({
        tier: 'dictionary',
        translation: r.value.translation,
        lemma: r.value.lemma,
        ...(r.value.partOfSpeech ? { partOfSpeech: r.value.partOfSpeech } : {}),
      });
    }

    const r = await deps.llm.translate(req);
    if (!r.ok) return err(r.error);

    const lemma = r.value.result.lemma ?? req.text;
    await deps.lookups.insert({
      sourceText: req.text,
      sourceLang: req.sourceLang,
      translation: r.value.result.translation,
      context: req.context,
      articleId: null,
      provider: 'anthropic',
      promptId: req.promptId,
      tier: 'llm',
      rawResponse: r.value.rawResponse,
    });
    await deps.vocabItems.upsert({ lemma, language: req.sourceLang });

    return ok({ tier: 'llm', result: r.value.result });
  },
});

export type TranslationService = ReturnType<typeof createTranslationService>;
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): TranslationService wiring providers to DB"
```

---

## Task 22: Zustand store — mode + active lookup

**Files:**
- Create: `apps/web/src/store/index.ts`
- Create: `apps/web/src/store/index.test.ts`

- [ ] **Step 1: Write failing test**

`apps/web/src/store/index.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './index.js';

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      mode: 'demo',
      apiKey: '',
      activeLookup: null,
    });
  });

  it('switches mode to byo-key', () => {
    useAppStore.getState().setMode('byo-key');
    expect(useAppStore.getState().mode).toBe('byo-key');
  });

  it('sets api key', () => {
    useAppStore.getState().setApiKey('sk-ant-xxx');
    expect(useAppStore.getState().apiKey).toBe('sk-ant-xxx');
  });
});
```

- [ ] **Step 2: Run — expect failure**

- [ ] **Step 3: Implement with persistence**

`apps/web/src/store/index.ts`:

```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type TranslationMode = 'demo' | 'byo-key';

export type ActiveLookup = {
  anchor: { x: number; y: number };
  status: 'loading' | 'ok' | 'error';
  payload?:
    | { kind: 'dictionary'; translation: string; lemma: string; partOfSpeech?: string }
    | { kind: 'llm'; translation: string; lemma?: string; grammarNotes?: string; examples?: { source: string; translation: string }[]; alternativeTranslations?: string[] };
  errorMessage?: string;
} | null;

type State = {
  mode: TranslationMode;
  apiKey: string;
  activeLookup: ActiveLookup;
  setMode: (m: TranslationMode) => void;
  setApiKey: (k: string) => void;
  setActiveLookup: (l: ActiveLookup) => void;
  clearActiveLookup: () => void;
};

export const useAppStore = create<State>()(
  persist(
    (set) => ({
      mode: 'demo',
      apiKey: '',
      activeLookup: null,
      setMode: (mode) => set({ mode }),
      setApiKey: (apiKey) => set({ apiKey }),
      setActiveLookup: (activeLookup) => set({ activeLookup }),
      clearActiveLookup: () => set({ activeLookup: null }),
    }),
    {
      name: 'lector-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ mode: s.mode, apiKey: s.apiKey }),
    },
  ),
);
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): app store (mode, api key, active lookup)"
```

---

# Phase E — UI

## Task 23: App routing + shell

**Files:**
- Modify: `apps/web/src/App.tsx`
- Create: `apps/web/src/views/reader/ReaderView.tsx`
- Create: `apps/web/src/views/settings/SettingsView.tsx`
- Create: `apps/web/src/views/debug/DebugView.tsx`

- [ ] **Step 1: Replace `App.tsx`**

`apps/web/src/App.tsx`:

```tsx
import { Link, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ReaderView } from './views/reader/ReaderView.js';
import { SettingsView } from './views/settings/SettingsView.js';
import { DebugView } from './views/debug/DebugView.js';

export const App = () => (
  <div className="min-h-screen flex flex-col">
    <header className="border-b px-6 py-3 flex items-center gap-6">
      <Link to="/" className="font-semibold text-lg">
        Lector
      </Link>
      <nav className="flex gap-4 text-sm text-muted-foreground">
        <Link to="/">Reader</Link>
        <Link to="/settings">Settings</Link>
        {import.meta.env.DEV && <Link to="/debug">Debug</Link>}
      </nav>
    </header>
    <main className="flex-1">
      <Routes>
        <Route path="/" element={<ReaderView />} />
        <Route path="/settings" element={<SettingsView />} />
        {import.meta.env.DEV && <Route path="/debug" element={<DebugView />} />}
      </Routes>
    </main>
    <Toaster richColors position="bottom-right" />
  </div>
);
```

- [ ] **Step 2: Stub views**

`apps/web/src/views/reader/ReaderView.tsx`:

```tsx
export const ReaderView = () => (
  <div className="max-w-3xl mx-auto p-6">
    <h2 className="text-xl font-semibold mb-4">Reader</h2>
    <p className="text-muted-foreground">Coming soon.</p>
  </div>
);
```

`apps/web/src/views/settings/SettingsView.tsx`:

```tsx
export const SettingsView = () => (
  <div className="max-w-xl mx-auto p-6">
    <h2 className="text-xl font-semibold mb-4">Settings</h2>
  </div>
);
```

`apps/web/src/views/debug/DebugView.tsx`:

```tsx
export const DebugView = () => (
  <div className="max-w-4xl mx-auto p-6">
    <h2 className="text-xl font-semibold mb-4">Debug</h2>
  </div>
);
```

- [ ] **Step 3: Typecheck + run existing tests**

Run: `pnpm --filter @lector/web typecheck && pnpm --filter @lector/web test`

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat(web): app shell with routing and toaster"
```

---

## Task 24: Seed article

**Files:**
- Create: `apps/web/src/views/reader/seed-article.ts`
- Create: `apps/web/src/views/reader/seed-article.test.ts`

- [ ] **Step 1: Write failing test**

`apps/web/src/views/reader/seed-article.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { seedArticle } from './seed-article.js';

describe('seedArticle', () => {
  it('has a Spanish title and body text of reasonable length', () => {
    expect(seedArticle.language).toBe('es');
    expect(seedArticle.title.length).toBeGreaterThan(0);
    expect(seedArticle.text.length).toBeGreaterThan(400);
    expect(seedArticle.text.length).toBeLessThan(2000);
  });
});
```

- [ ] **Step 2: Run — expect failure**

- [ ] **Step 3: Implement**

`apps/web/src/views/reader/seed-article.ts`:

```ts
export const seedArticle = {
  title: 'Una tarde en el mercado',
  language: 'es' as const,
  text: `Ayer por la tarde, caminaba por el mercado del barrio cuando me encontré con una vieja amiga. Hacía meses que no nos veíamos, y aunque tenía prisa, decidí pararme un rato para charlar. Me contó que había empezado un curso de cocina para mejorar sus recetas tradicionales, y que últimamente pasaba más tiempo en la cocina que en la oficina.

Aunque no suelo ser muy aficionado a cocinar, la idea me pareció tentadora. Le dije que, si pudiera, la acompañaría la próxima vez. Ella sonrió y me dijo: "Más vale tarde que nunca." Nos reímos y quedamos en vernos el sábado por la mañana.

Al volver a casa, me puse a pensar en cuántas veces dejamos pasar las oportunidades por falta de tiempo. Quizá lo importante no sea tener tiempo, sino hacerlo. Mañana, si no llueve, iré al mismo mercado, aunque sea solo para comprar fruta y saludar a la gente del barrio.`,
};
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web/reader): seeded Spanish demo article"
```

---

## Task 25: Reader view — paste + tokenized render

**Files:**
- Modify: `apps/web/src/views/reader/ReaderView.tsx`
- Create: `apps/web/src/views/reader/ArticleRenderer.tsx`
- Create: `apps/web/src/views/reader/ArticleRenderer.test.tsx`

- [ ] **Step 1: Write failing test**

`apps/web/src/views/reader/ArticleRenderer.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArticleRenderer } from './ArticleRenderer.js';

describe('ArticleRenderer', () => {
  it('renders word tokens as individual spans', () => {
    render(<ArticleRenderer text="Hola mundo." onWordClick={() => {}} onSelection={() => {}} />);
    expect(screen.getByText('Hola')).toBeInTheDocument();
    expect(screen.getByText('mundo')).toBeInTheDocument();
  });

  it('calls onWordClick with the word and sentence', () => {
    const onWord = vi.fn();
    render(
      <ArticleRenderer
        text="Hola mundo. Adios amigo."
        onWordClick={onWord}
        onSelection={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('mundo'));
    expect(onWord).toHaveBeenCalledTimes(1);
    const call = onWord.mock.calls[0]![0];
    expect(call.word).toBe('mundo');
    expect(call.sentence).toBe('Hola mundo.');
  });
});
```

- [ ] **Step 2: Run — expect failure**

- [ ] **Step 3: Implement `ArticleRenderer`**

`apps/web/src/views/reader/ArticleRenderer.tsx`:

```tsx
import { useMemo, useRef } from 'react';
import { tokenize, sentenceAround } from '@/services/text/tokenize.js';

type WordClickPayload = { word: string; offset: number; sentence: string; anchor: { x: number; y: number } };
type SelectionPayload = { text: string; offset: number; sentence: string; anchor: { x: number; y: number } };

type Props = {
  text: string;
  onWordClick: (p: WordClickPayload) => void;
  onSelection: (p: SelectionPayload) => void;
};

export const ArticleRenderer = ({ text, onWordClick, onSelection }: Props) => {
  const tokens = useMemo(() => tokenize(text, 'es'), [text]);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const selected = sel.toString().trim();
    if (!selected || !selected.includes(' ')) return;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerText = containerRef.current?.innerText ?? text;
    const offset = containerText.indexOf(selected);
    const sentence = offset >= 0 ? sentenceAround(text, offset, 'es') : text;
    onSelection({
      text: selected,
      offset: offset < 0 ? 0 : offset,
      sentence,
      anchor: { x: rect.left + rect.width / 2, y: rect.bottom + 8 },
    });
  };

  return (
    <div
      ref={containerRef}
      className="prose prose-lg max-w-none leading-relaxed whitespace-pre-wrap"
      onMouseUp={handleMouseUp}
    >
      {tokens.map((t, i) =>
        t.isWord ? (
          <span
            key={i}
            className="cursor-pointer hover:bg-accent hover:text-accent-foreground rounded px-0.5"
            onClick={(ev) => {
              ev.stopPropagation();
              const rect = (ev.target as HTMLElement).getBoundingClientRect();
              onWordClick({
                word: t.text,
                offset: t.start,
                sentence: sentenceAround(text, t.start, 'es'),
                anchor: { x: rect.left + rect.width / 2, y: rect.bottom + 8 },
              });
            }}
          >
            {t.text}
          </span>
        ) : (
          <span key={i}>{t.text}</span>
        ),
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web/reader): ArticleRenderer with click and selection handlers"
```

---

## Task 26: Popover for translation results

**Files:**
- Create: `apps/web/src/views/reader/TranslationPopover.tsx`

This is a presentation component — it renders whichever payload kind is in the active-lookup state.

- [ ] **Step 1: Implement**

`apps/web/src/views/reader/TranslationPopover.tsx`:

```tsx
import { useAppStore, type ActiveLookup } from '@/store/index.js';
import { Loader2, X } from 'lucide-react';

const position = (anchor: { x: number; y: number }): React.CSSProperties => ({
  position: 'fixed',
  left: anchor.x,
  top: anchor.y,
  transform: 'translateX(-50%)',
  zIndex: 50,
});

export const TranslationPopover = () => {
  const active = useAppStore((s) => s.activeLookup);
  const clear = useAppStore((s) => s.clearActiveLookup);
  if (!active) return null;

  return (
    <div
      style={position(active.anchor)}
      className="bg-popover text-popover-foreground border rounded-lg shadow-md w-80 max-w-[90vw] p-3 text-sm"
      role="dialog"
    >
      <button
        className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-foreground"
        onClick={clear}
        aria-label="Close"
      >
        <X size={14} />
      </button>
      <Body active={active} />
    </div>
  );
};

const Body = ({ active }: { active: NonNullable<ActiveLookup> }) => {
  if (active.status === 'loading') {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="animate-spin" size={14} /> Translating…
      </div>
    );
  }
  if (active.status === 'error') {
    return <div className="text-destructive">{active.errorMessage ?? 'Translation failed'}</div>;
  }
  const p = active.payload!;
  if (p.kind === 'dictionary') {
    return (
      <div className="space-y-1">
        <div className="font-medium">{p.translation}</div>
        <div className="text-xs text-muted-foreground">
          {p.lemma}
          {p.partOfSpeech ? ` · ${p.partOfSpeech}` : ''}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="font-medium">{p.translation}</div>
      {p.lemma && <div className="text-xs text-muted-foreground">lemma: {p.lemma}</div>}
      {p.grammarNotes && <div className="text-xs">{p.grammarNotes}</div>}
      {p.examples && p.examples.length > 0 && (
        <ul className="text-xs space-y-1 border-l pl-2">
          {p.examples.map((e, i) => (
            <li key={i}>
              <div className="italic">{e.source}</div>
              <div className="text-muted-foreground">{e.translation}</div>
            </li>
          ))}
        </ul>
      )}
      {p.alternativeTranslations && p.alternativeTranslations.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Also: {p.alternativeTranslations.join(', ')}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web
git commit -m "feat(web/reader): TranslationPopover rendering dictionary and llm payloads"
```

---

## Task 27: ReaderView — wire providers + service + UI

**Files:**
- Modify: `apps/web/src/views/reader/ReaderView.tsx`
- Create: `apps/web/src/views/reader/use-translation.ts`

The hook constructs the providers based on the current mode and returns a single `translate(request)` function that drives the active-lookup state.

- [ ] **Step 1: Write `use-translation.ts`**

`apps/web/src/views/reader/use-translation.ts`:

```ts
import { useMemo } from 'react';
import { toast } from 'sonner';
import { getDb } from '@/services/db/index.js';
import { createWiktionaryDictionary } from '@/services/providers/dictionary.js';
import { createLLMProvider } from '@/services/providers/llm.js';
import { createTranslationService } from '@/services/translation/translation-service.js';
import { useAppStore } from '@/store/index.js';
import { isOk } from '@lector/shared';
import type { TierRequest } from '@/services/translation/translation-service.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787';

export const useTranslation = () => {
  const mode = useAppStore((s) => s.mode);
  const apiKey = useAppStore((s) => s.apiKey);
  const setActiveLookup = useAppStore((s) => s.setActiveLookup);

  const service = useMemo(() => {
    const dict = createWiktionaryDictionary();
    const llm =
      mode === 'byo-key' && apiKey
        ? createLLMProvider({ mode: 'direct', anthropicKey: apiKey })
        : createLLMProvider({ mode: 'proxy', apiBaseUrl: API_BASE_URL });

    return {
      dict,
      llm,
      // repos are lazily resolved per-call to avoid blocking initial render
      run: async (req: TierRequest, anchor: { x: number; y: number }) => {
        setActiveLookup({ anchor, status: 'loading' });
        const db = await getDb();
        const svc = createTranslationService({
          dict,
          llm,
          lookups: db.lookups,
          vocabItems: db.vocabItems,
        });
        const r = await svc.translate(req);
        if (isOk(r)) {
          const payload =
            r.value.tier === 'dictionary'
              ? {
                  kind: 'dictionary' as const,
                  translation: r.value.translation,
                  lemma: r.value.lemma,
                  ...(r.value.partOfSpeech ? { partOfSpeech: r.value.partOfSpeech } : {}),
                }
              : {
                  kind: 'llm' as const,
                  translation: r.value.result.translation,
                  ...(r.value.result.lemma ? { lemma: r.value.result.lemma } : {}),
                  ...(r.value.result.grammarNotes
                    ? { grammarNotes: r.value.result.grammarNotes }
                    : {}),
                  ...(r.value.result.examples ? { examples: r.value.result.examples } : {}),
                  ...(r.value.result.alternativeTranslations
                    ? { alternativeTranslations: r.value.result.alternativeTranslations }
                    : {}),
                };
          setActiveLookup({ anchor, status: 'ok', payload });
          return;
        }

        let msg = 'Translation failed.';
        if (r.error.reason === 'rate_limited') {
          msg = 'Demo limit reached. Add your Anthropic key in Settings to continue.';
          toast.error(msg);
        } else if (r.error.reason === 'unauthorized') {
          msg = 'Your API key was rejected. Check Settings.';
          toast.error(msg);
        } else if (r.error.reason === 'not_found') {
          msg = 'No dictionary entry. Try a longer selection for an LLM translation.';
        } else {
          toast.error(msg);
        }
        setActiveLookup({ anchor, status: 'error', errorMessage: msg });
      },
    };
  }, [mode, apiKey, setActiveLookup]);

  return service;
};
```

- [ ] **Step 2: Modify `ReaderView.tsx`**

`apps/web/src/views/reader/ReaderView.tsx`:

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button.js';
import { Textarea } from '@/components/ui/textarea.js';
import { ArticleRenderer } from './ArticleRenderer.js';
import { TranslationPopover } from './TranslationPopover.js';
import { useTranslation } from './use-translation.js';
import { seedArticle } from './seed-article.js';

export const ReaderView = () => {
  const [draft, setDraft] = useState('');
  const [text, setText] = useState(seedArticle.text);
  const translation = useTranslation();

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <section className="space-y-2">
        <label className="text-sm font-medium">Paste article text</label>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          placeholder="Paste Spanish article text here..."
        />
        <div className="flex gap-2">
          <Button
            onClick={() => {
              if (draft.trim()) setText(draft.trim());
            }}
          >
            Read
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setDraft('');
              setText(seedArticle.text);
            }}
          >
            Reset to demo article
          </Button>
        </div>
      </section>

      <article className="border-t pt-6">
        <ArticleRenderer
          text={text}
          onWordClick={(p) =>
            translation.run(
              {
                text: p.word,
                context: p.sentence,
                sourceLang: 'es',
                targetLang: 'en',
                promptId: 'es-basic',
                tier: 'dictionary',
              },
              p.anchor,
            )
          }
          onSelection={(p) =>
            translation.run(
              {
                text: p.text,
                context: p.sentence,
                sourceLang: 'es',
                targetLang: 'en',
                promptId: 'es-basic',
                tier: 'llm',
              },
              p.anchor,
            )
          }
        />
      </article>

      <TranslationPopover />
    </div>
  );
};
```

- [ ] **Step 3: Typecheck + tests**

Run: `pnpm --filter @lector/web typecheck && pnpm --filter @lector/web test`

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat(web/reader): end-to-end reader view with translation popover"
```

---

## Task 28: Settings view

**Files:**
- Modify: `apps/web/src/views/settings/SettingsView.tsx`

- [ ] **Step 1: Implement**

`apps/web/src/views/settings/SettingsView.tsx`:

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Switch } from '@/components/ui/switch.js';
import { useAppStore } from '@/store/index.js';
import { toast } from 'sonner';

export const SettingsView = () => {
  const mode = useAppStore((s) => s.mode);
  const apiKey = useAppStore((s) => s.apiKey);
  const setMode = useAppStore((s) => s.setMode);
  const setApiKey = useAppStore((s) => s.setApiKey);
  const [draft, setDraft] = useState(apiKey);

  return (
    <div className="max-w-xl mx-auto p-6 space-y-8">
      <h2 className="text-xl font-semibold">Settings</h2>

      <section className="space-y-2">
        <Label>Translation mode</Label>
        <div className="flex items-center justify-between border rounded-md px-4 py-3">
          <div>
            <div className="font-medium">
              {mode === 'demo' ? 'Demo mode' : 'Use my own key'}
            </div>
            <p className="text-xs text-muted-foreground">
              Demo routes LLM calls through our server (rate-limited). Your own key goes directly to Anthropic from your browser.
            </p>
          </div>
          <Switch
            checked={mode === 'byo-key'}
            onCheckedChange={(checked) => setMode(checked ? 'byo-key' : 'demo')}
          />
        </div>
      </section>

      <section className="space-y-2">
        <Label htmlFor="api-key">Anthropic API key (BYO-key mode)</Label>
        <Input
          id="api-key"
          type="password"
          autoComplete="off"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="sk-ant-..."
        />
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setApiKey(draft.trim());
              toast.success('Key saved');
            }}
            disabled={!draft.trim() || draft === apiKey}
          >
            Save key
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setDraft('');
              setApiKey('');
              toast.success('Key cleared');
            }}
            disabled={!apiKey}
          >
            Clear
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Stored in your browser. Never sent to our backend.
        </p>
      </section>
    </div>
  );
};
```

- [ ] **Step 2: Typecheck + test**

Run: `pnpm --filter @lector/web typecheck && pnpm --filter @lector/web test`

- [ ] **Step 3: Commit**

```bash
git add apps/web
git commit -m "feat(web/settings): mode toggle and api key input"
```

---

## Task 29: Debug view

**Files:**
- Modify: `apps/web/src/views/debug/DebugView.tsx`

- [ ] **Step 1: Implement**

`apps/web/src/views/debug/DebugView.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button.js';
import { getDb } from '@/services/db/index.js';
import type { LookupRow, VocabItemRow } from '@lector/shared';

export const DebugView = () => {
  const [lookups, setLookups] = useState<LookupRow[]>([]);
  const [vocab, setVocab] = useState<VocabItemRow[]>([]);

  const refresh = async () => {
    const db = await getDb();
    setLookups(await db.lookups.list());
    setVocab(await db.vocabItems.listAll());
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Debug</h2>
        <Button onClick={refresh} variant="outline">
          Refresh
        </Button>
      </div>

      <section>
        <h3 className="font-medium mb-2">vocab_items ({vocab.length})</h3>
        <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-96">
          {JSON.stringify(vocab, null, 2)}
        </pre>
      </section>

      <section>
        <h3 className="font-medium mb-2">lookups ({lookups.length})</h3>
        <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-96">
          {JSON.stringify(lookups, null, 2)}
        </pre>
      </section>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web
git commit -m "feat(web/debug): dev-only route dumping lookups and vocab"
```

---

## Task 30: Favicon, manifest, meta

**Files:**
- Create: `apps/web/public/favicon.svg`
- Modify: `apps/web/index.html`

- [ ] **Step 1: Write `apps/web/public/favicon.svg`**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#18181b"/>
  <text x="16" y="22" font-family="Georgia, serif" font-size="18" text-anchor="middle" fill="#fff">L</text>
</svg>
```

- [ ] **Step 2: Modify `apps/web/index.html`**

Update the `<head>` to include:

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<meta name="description" content="Lector — read articles in another language, click to translate, export to Anki." />
```

- [ ] **Step 3: Commit**

```bash
git add apps/web
git commit -m "chore(web): favicon and meta"
```

---

# Phase F — Deploy + README

## Task 31: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write CI**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9.12.0 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
```

- [ ] **Step 2: Commit and push**

```bash
git add .github
git commit -m "ci: typecheck, lint, test, build on PR and main"
```

(Push step deferred until after Vercel/Fly config is in.)

---

## Task 32: Vercel config for `apps/web`

**Files:**
- Create: `vercel.json`

Vercel deploys from the repo root but the frontend lives in `apps/web`. Direct Vercel at the right build.

- [ ] **Step 1: Write `vercel.json`**

```json
{
  "buildCommand": "pnpm --filter @lector/web... build",
  "installCommand": "corepack enable && pnpm install --frozen-lockfile",
  "outputDirectory": "apps/web/dist",
  "framework": null,
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "chore(deploy): vercel config for apps/web"
```

---

## Task 33: GitHub Actions deploy workflow for Fly

**Files:**
- Create: `.github/workflows/deploy-api.yml`

- [ ] **Step 1: Write workflow**

`.github/workflows/deploy-api.yml`:

```yaml
name: Deploy API

on:
  push:
    branches: [main]
    paths:
      - 'apps/api/**'
      - 'packages/shared/**'
      - 'pnpm-lock.yaml'
      - '.github/workflows/deploy-api.yml'

concurrency:
  group: deploy-api
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only --config apps/api/fly.toml --dockerfile apps/api/Dockerfile
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

- [ ] **Step 2: Commit**

```bash
git add .github
git commit -m "ci: fly deploy workflow for api"
```

---

## Task 34: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

`README.md`:

```markdown
# Lector

A reading-based language-learning tool. Paste Spanish text, click words or select phrases for in-context translation, and every lookup is persisted to a local SQLite database in your browser.

**Live demo:** <TODO: fill in after first Vercel deploy>

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

- **Frontend**: `main` auto-deploys to Vercel via the `vercel.json` in repo root.
- **Backend**: `main` auto-deploys to Fly.io via `.github/workflows/deploy-api.yml`. Needs `FLY_API_TOKEN` secret.

## Status

Phase 1 of 3. See `CLAUDE.md` for the project's phased plan.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: project README"
```

---

## Task 35: First deploy + acceptance walk-through

This task is a manual checklist; no code.

- [ ] **Step 1: Create Fly app**

Run (local, one-time):
```bash
cd apps/api
flyctl launch --no-deploy --name lector-api
flyctl secrets set ANTHROPIC_API_KEY=sk-ant-... ALLOWED_ORIGINS=https://<your-vercel-domain>
```

- [ ] **Step 2: Push to GitHub**

Create the repo (public) and push:
```bash
git remote add origin https://github.com/<you>/lector.git
git push -u origin main
```

- [ ] **Step 3: Add Vercel project**

Import the repo in Vercel dashboard. Framework: "Other". It will read `vercel.json`. Set env var `VITE_API_BASE_URL=https://lector-api.fly.dev`. Trigger a deploy.

- [ ] **Step 4: Add Fly token to GitHub Secrets**

`FLY_API_TOKEN` from `flyctl auth token`.

- [ ] **Step 5: Re-push to trigger full deploy**

An empty commit is fine:
```bash
git commit --allow-empty -m "chore: trigger first deploy"
git push
```

- [ ] **Step 6: Acceptance walk-through**

On the deployed URL, verify in order:
1. Home page loads in under 2s on a cold cache.
2. Seeded Spanish article is visible.
3. Clicking a Spanish word shows a dictionary popover with translation + part of speech.
4. Selecting a phrase ("más vale tarde que nunca") shows an LLM popover with structured output (primary translation, grammar note, examples).
5. `/api/health` returns `{"ok":true}` via `curl https://lector-api.fly.dev/api/health`.
6. Triggering 21 LLM calls in a row from one IP eventually produces a toast: *Demo limit reached…*
7. Go to Settings, toggle to BYO-key mode, paste your own key, translate a phrase — should succeed without the rate limit applying.
8. Open `/debug` (dev only — verify NOT reachable on production build). Confirm lookups and vocab rows.
9. Refresh the page; vocab rows persist.

- [ ] **Step 7: Fill in the demo URL in README and commit**

```bash
git add README.md
git commit -m "docs: add live demo URL"
git push
```

---

# End of plan

At this point M1 is live. Next: write M2 spec + plan (vocab view). The `vocab_items` table has been populated through all of M1, so M2 is pure UI.
