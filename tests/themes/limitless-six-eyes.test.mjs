import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { loadThemePackage, SEMANTIC_COLOR_ROLES } from '../../src/engine/theme.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');
const themeRoot = join(repoRoot, 'themes/limitless-six-eyes');

describe('Limitless Six Eyes flagship theme', () => {
  test('ships a complete schema-v2 experience manifest', async () => {
    const loaded = await loadThemePackage(themeRoot);

    expect(loaded.manifest.slug).toBe('limitless-six-eyes');
    expect(loaded.manifest.mode).toBe('light');
    expect(Object.keys(loaded.manifest.palette)).toEqual(SEMANTIC_COLOR_ROLES);
    expect(loaded.manifest.tags).toEqual(
      expect.arrayContaining(['featured', 'full-workspace', 'composer', 'editorial']),
    );
    expect(loaded.manifest.experience).toEqual({
      brand: 'LIMITLESS',
      eyebrow: 'SIX EYES',
      headline: 'LIMITLESS WORKSPACE',
      tagline: 'Plan beyond the visible.',
      status: 'LIMITLESS ONLINE',
      signature: 'SATORU GOJO',
      chrome: true,
    });
  });

  test('covers the native workspace, home, interaction, code, and ambient layers', async () => {
    const css = await readFile(join(themeRoot, 'theme.css'), 'utf8');

    for (const marker of [
      '.app-shell-left-panel',
      '[data-awesome-codex-home="true"]',
      '[data-feature="game-source"]',
      '[role="menu"]',
      'input',
      ':hover',
      ':focus-visible',
      '::selection',
      '.monaco-editor',
      '.composer-root',
      '::-webkit-scrollbar-thumb',
      '.act-experience__brand',
      '.act-experience__orbit',
      '.act-experience__particle',
      '@media (prefers-reduced-motion: reduce)',
    ]) {
      expect(css, marker).toContain(marker);
    }
  });

  test('keeps prototype artwork outside the repository MIT grant', async () => {
    const [license, backgroundInfo, previewInfo] = await Promise.all([
      readFile(join(themeRoot, 'ASSET_LICENSE.md'), 'utf8'),
      stat(join(themeRoot, 'background.jpg')),
      stat(join(themeRoot, 'preview.png')),
    ]);

    expect(license).toContain('PROTOTYPE-REFERENCE-ONLY');
    expect(license).toMatch(/not covered by the repository MIT license/i);
    expect(license).toMatch(/must be replaced/i);
    expect(backgroundInfo.size).toBeGreaterThan(100_000);
    expect(backgroundInfo.size).toBeLessThan(700 * 1024);
    expect(previewInfo.size).toBeGreaterThan(100_000);
  });
});
