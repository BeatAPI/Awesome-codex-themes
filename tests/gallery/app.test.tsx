// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { App } from '../../src/gallery/App';

describe('theme gallery', () => {
  test('presents the flagship-led collection and project boundary', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /make codex feel like yours/i })).toBeInTheDocument();
    expect(screen.getByText('12 complete themes')).toBeInTheDocument();
    expect(screen.getByText('1 featured flagship')).toBeInTheDocument();
    expect(screen.getByText(/unofficial and not affiliated/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Satoru Gojo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Night City' })).toBeInTheDocument();
    expect(screen.getByText('五条 悟')).toBeInTheDocument();
    expect(screen.getByText(/inspectable adapter/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Satoru Gojo color palette').querySelectorAll('span')).toHaveLength(5);
    expect(screen.getAllByRole('button', { name: /^view /i })[0]).toHaveAccessibleName('View Satoru Gojo');
  }, 15_000);

  test('searches across names, descriptions, categories, and tags', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByRole('searchbox', { name: /search themes/i }), '五条');

    expect(screen.getByRole('heading', { name: 'Satoru Gojo' })).toBeInTheDocument();
    expect(screen.getByText('1 theme shown')).toBeInTheDocument();
  });

  test('filters by category and recovers with a clear action', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Editorial' }));
    expect(screen.getByRole('heading', { name: 'Satoru Gojo' })).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: /search themes/i }), 'nonexistent');
    expect(screen.getByRole('heading', { name: /no matching themes/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /clear search and filters/i }));
    expect(screen.getByRole('heading', { name: 'Satoru Gojo' })).toBeInTheDocument();
  });

  test('opens structured details and copies the exact CLI command', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    render(<App />);

    await user.click(screen.getByRole('button', { name: /view satoru gojo/i }));
    const dialog = screen.getByRole('dialog', { name: 'Satoru Gojo' });
    expect(dialog).toHaveTextContent('Best effort on every numeric Codex Desktop version');
    expect(dialog).toHaveTextContent('Highly compatible');
    expect(dialog).toHaveTextContent('26.707.*');
    expect(dialog).toHaveTextContent('26.715.*');
    expect(dialog).toHaveTextContent('PROJECT-ASSET');
    expect(dialog).toHaveTextContent('Full workspace');
    expect(dialog).toHaveTextContent(/pause.*restore.*GitHub Issue/i);
    await user.click(screen.getByRole('button', { name: /copy install command/i }));

    expect(writeText).toHaveBeenCalledWith('./bin/awesome-codex-themes install-agent satoru-gojo');
    expect(screen.getByRole('button', { name: /command copied/i })).toBeInTheDocument();
  });

  test('shows the approved project artwork without a prototype restriction warning', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /view satoru gojo/i }));

    const dialog = screen.getByRole('dialog', { name: 'Satoru Gojo' });
    expect(dialog).toHaveTextContent('五条 悟');
    expect(dialog).toHaveTextContent('PROJECT-ASSET');
    expect(dialog).toHaveTextContent('Full workspace');
    expect(dialog).not.toHaveTextContent(/private fan|must be replaced|public or commercial release/i);
  });
});
