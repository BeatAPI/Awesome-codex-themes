import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

import {
  ThemeValidationError,
  loadThemePackage,
  validateThemeManifest,
} from '../../src/engine/theme.mjs';

const tempDirs = [];

function validManifest(overrides = {}) {
  return {
    schemaVersion: 1,
    slug: 'test-theme',
    version: '1.0.0',
    name: 'Test Theme',
    description: 'A small original theme used by the test suite.',
    author: { name: 'Awesome Codex Themes contributors' },
    license: { code: 'MIT', artwork: 'CC0-1.0' },
    categories: ['dark', 'minimal'],
    tags: ['blue', 'focus'],
    compatibility: {
      platforms: ['macos'],
      status: 'experimental',
      appVersions: ['26.707.*'],
    },
    palette: {
      background: '#07111F',
      surface: '#142033CC',
      text: '#F4F7FB',
      accent: '#73E2FF',
    },
    files: {
      css: 'theme.css',
      artwork: 'background.svg',
      preview: 'preview.svg',
    },
    ...overrides,
  };
}

async function createTheme(manifest = validManifest(), options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'awesome-codex-theme-'));
  tempDirs.push(root);
  await mkdir(root, { recursive: true });
  await writeFile(join(root, 'theme.json'), JSON.stringify(manifest, null, 2));
  await writeFile(join(root, 'theme.css'), options.css ?? ':root.awesome-codex-theme { color: var(--act-text); }');
  await writeFile(join(root, 'background.svg'), options.artwork ?? '<svg xmlns="http://www.w3.org/2000/svg"/>');
  await writeFile(join(root, 'preview.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  return root;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('validateThemeManifest', () => {
  test('normalizes a valid manifest without weakening its license metadata', () => {
    const manifest = validateThemeManifest(validManifest());

    expect(manifest.slug).toBe('test-theme');
    expect(manifest.license).toEqual({ code: 'MIT', artwork: 'CC0-1.0' });
    expect(manifest.tags).toEqual(['blue', 'focus']);
  });

  test.each([
    [{ slug: '../escape' }, 'THEME_SLUG_INVALID'],
    [{ version: 'latest' }, 'THEME_VERSION_INVALID'],
    [{ palette: { ...validManifest().palette, accent: 'blue' } }, 'THEME_COLOR_INVALID'],
    [{ compatibility: { ...validManifest().compatibility, platforms: ['windows'] } }, 'THEME_PLATFORM_UNSUPPORTED'],
    [{ files: { ...validManifest().files, artwork: 'https://example.com/art.svg' } }, 'THEME_PATH_UNSAFE'],
  ])('rejects unsafe or unsupported metadata with a stable code', (overrides, code) => {
    expect(() => validateThemeManifest(validManifest(overrides))).toThrowError(
      expect.objectContaining({ code }),
    );
  });
});

describe('loadThemePackage', () => {
  test('loads local CSS and artwork into a runtime-safe payload', async () => {
    const root = await createTheme();

    const theme = await loadThemePackage(root);

    expect(theme.manifest.slug).toBe('test-theme');
    expect(theme.css).toContain('awesome-codex-theme');
    expect(theme.artwork.mime).toBe('image/svg+xml');
    expect(theme.artwork.dataUrl).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(theme.artwork.bytes).toBeGreaterThan(0);
  });

  test('rejects path traversal before reading outside the theme directory', async () => {
    const manifest = validManifest({
      files: { ...validManifest().files, css: '../stolen.css' },
    });
    const root = await createTheme(manifest);

    await expect(loadThemePackage(root)).rejects.toEqual(
      expect.objectContaining({ code: 'THEME_PATH_UNSAFE' }),
    );
  });

  test('rejects oversized artwork using the configured byte ceiling', async () => {
    const root = await createTheme(validManifest(), { artwork: Buffer.alloc(32, 1) });

    await expect(loadThemePackage(root, { maxAssetBytes: 16 })).rejects.toEqual(
      expect.objectContaining({ code: 'THEME_ASSET_TOO_LARGE' }),
    );
  });

  test.each([
    ['@import url("https://example.com/theme.css");', 'THEME_CSS_REMOTE_IMPORT'],
    [':root { background: url(//example.com/track.png); }', 'THEME_CSS_REMOTE_IMPORT'],
    [':root { background: url(javascript:alert(1)); }', 'THEME_CSS_UNSAFE_URL'],
  ])('rejects CSS that can execute or load remote content', async (css, code) => {
    const root = await createTheme(validManifest(), { css });

    await expect(loadThemePackage(root)).rejects.toEqual(expect.objectContaining({ code }));
  });

  test('uses a typed error for malformed JSON', async () => {
    const root = await createTheme();
    await writeFile(join(root, 'theme.json'), '{broken');

    await expect(loadThemePackage(root)).rejects.toBeInstanceOf(ThemeValidationError);
  });
});
