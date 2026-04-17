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

const truncate = (s: string, n = 500) => (s.length > n ? `${s.slice(0, n)}…` : s);

const stripCodeFences = (s: string): string => {
  const trimmed = s.trim();
  const m = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  return m?.[1]?.trim() ?? trimmed;
};

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
    if (!resp.ok) {
      let bodyDetail = `status ${resp.status}`;
      try {
        const errBody = (await resp.json()) as {
          error?: string;
          message?: string;
          rawResponse?: string;
        };
        const parts = [
          `status ${resp.status}`,
          errBody.message,
          errBody.rawResponse ? `raw: ${truncate(errBody.rawResponse)}` : null,
        ].filter(Boolean);
        bodyDetail = parts.join(' | ');
        console.error('[llm:proxy] upstream error', { status: resp.status, body: errBody });
      } catch {
        // non-JSON body; keep default detail
      }
      return err({ reason: 'server', detail: bodyDetail });
    }

    const json = await resp.json();
    const parsed = TranslateResponseSchema.safeParse(json);
    if (!parsed.success) {
      console.error('[llm:proxy] schema validation failed', {
        json,
        issues: parsed.error.issues,
      });
      return err({ reason: 'zod', detail: parsed.error.message });
    }
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
      let lastDetail = '';
      for (let attempt = 0; attempt < 2; attempt++) {
        const text = await call();
        let json: unknown;
        try {
          json = JSON.parse(stripCodeFences(text));
        } catch (e) {
          lastDetail = `JSON parse failed: ${(e as Error).message}; raw: ${truncate(text)}`;
          console.error('[llm:direct] JSON.parse failed', { text, error: e });
          continue;
        }
        const parsed = LLMTranslationSchema.safeParse(json);
        if (parsed.success) return ok({ result: parsed.data, rawResponse: text });
        lastDetail = `schema validation failed: ${parsed.error.message}; raw: ${truncate(text)}`;
        console.error('[llm:direct] schema validation failed', {
          text,
          issues: parsed.error.issues,
        });
      }
      return err({ reason: 'zod', detail: lastDetail });
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
