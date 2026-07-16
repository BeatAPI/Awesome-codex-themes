// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { App } from '../../src/gallery/App';

describe('theme gallery', () => {
  test('presents the original launch collection and project boundary', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /a field guide to codex/i })).toBeInTheDocument();
    expect(screen.getByText('4 original themes')).toBeInTheDocument();
    expect(screen.getByText(/unofficial and not affiliated/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Obsidian Bloom' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Paper Circuit' })).toBeInTheDocument();
  });

  test('searches across names, descriptions, categories, and tags', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByRole('searchbox', { name: /search themes/i }), 'aurora');

    expect(screen.getByRole('heading', { name: 'Arctic Signal' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Solar Archive' })).not.toBeInTheDocument();
    expect(screen.getByText('1 theme shown')).toBeInTheDocument();
  });

  test('filters by category and recovers with a clear action', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Editorial' }));
    expect(screen.getByRole('heading', { name: 'Paper Circuit' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Solar Archive' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Arctic Signal' })).not.toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: /search themes/i }), 'nonexistent');
    expect(screen.getByRole('heading', { name: /no matching themes/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /clear search and filters/i }));
    expect(screen.getByRole('heading', { name: 'Arctic Signal' })).toBeInTheDocument();
  });

  test('opens structured details and copies the exact CLI command', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    render(<App />);

    await user.click(screen.getByRole('button', { name: /view obsidian bloom/i }));
    const dialog = screen.getByRole('dialog', { name: 'Obsidian Bloom' });
    expect(dialog).toHaveTextContent('26.707.*');
    expect(dialog).toHaveTextContent('CC0-1.0');
    await user.click(screen.getByRole('button', { name: /copy apply command/i }));

    expect(writeText).toHaveBeenCalledWith('awesome-codex-themes start obsidian-bloom');
    expect(screen.getByRole('button', { name: /command copied/i })).toBeInTheDocument();
  });
});
