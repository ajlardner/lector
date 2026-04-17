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
