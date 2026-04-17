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
