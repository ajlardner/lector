import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import Anthropic from '@anthropic-ai/sdk';
import {
  TranslateRequestSchema,
  esBasicPrompt,
  isErr,
} from '@lector/shared';
import * as anthropicModule from '../anthropic.js';
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
      const result = await anthropicModule.translateWithRetry(client, {
        systemPrompt,
        userPrompt: `Translate "${body.text}" in the given context.`,
        model: anthropicModule.DEFAULT_MODEL,
      });
      if (isErr(result)) {
        const rawResponse =
          'rawResponse' in result.error
            ? (result.error as { rawResponse?: string }).rawResponse
            : undefined;
        return c.json(
          {
            error: 'upstream_error',
            message: result.error.reason,
            ...(rawResponse ? { rawResponse: rawResponse.slice(0, 1000) } : {}),
          },
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
