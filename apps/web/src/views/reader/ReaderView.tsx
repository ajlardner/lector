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
