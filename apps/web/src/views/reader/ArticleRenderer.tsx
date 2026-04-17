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
