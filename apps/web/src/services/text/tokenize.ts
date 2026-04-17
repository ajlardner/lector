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
