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
    expect(screen.getByRole('link', { name: /^lector$/i })).toBeInTheDocument();
  });
});
