import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

import { buildThemeCatalog, writeThemeCatalog } from '../../scripts/catalog.mjs';
import { SEMANTIC_COLOR_ROLES } from '../../src/engine/theme.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');
const themesRoot = join(repoRoot, 'themes');
const tempDirs = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('theme catalog', () => {
  test('loads the five themes in deterministic package order', async () => {
    const catalog = await buildThemeCatalog(themesRoot);

    expect(catalog.map((theme) => theme.slug)).toEqual([
      'arctic-signal',
      'limitless-six-eyes',
      'obsidian-bloom',
      'paper-circuit',
      'solar-archive',
    ]);
    expect(catalog.every((theme) => theme.compatibility.status === 'experimental')).toBe(true);
    expect(catalog.every((theme) => theme.command.startsWith('awesome-codex-themes start '))).toBe(true);
    expect(catalog.every((theme) => theme.preview.startsWith('/theme-assets/'))).toBe(true);
  });

  test('ships Obsidian Bloom as a schema-v2 full semantic theme', async () => {
    const manifest = JSON.parse(await readFile(join(themesRoot, 'obsidian-bloom', 'theme.json'), 'utf8'));

    expect(manifest.schemaVersion).toBe(2);
    expect(Object.keys(manifest.palette)).toEqual(SEMANTIC_COLOR_ROLES);
    expect(manifest.version).toBe('1.1.0');
    expect(manifest.tags).toContain('full-workspace');
  });

  test('publishes Limitless Six Eyes metadata for a flagship experience', async () => {
    const catalog = await buildThemeCatalog(themesRoot);
    const theme = catalog.find((item) => item.slug === 'limitless-six-eyes');

    expect(theme?.tags).toContain('featured');
    expect(theme?.tags).toContain('full-workspace');
    expect(theme?.license.artwork).toBe('PROTOTYPE-REFERENCE-ONLY');
    expect(theme?.experience).toEqual(
      expect.objectContaining({
        brand: 'LIMITLESS',
        status: 'LIMITLESS ONLINE',
        chrome: true,
      }),
    );
  });

  test('keeps the other launch themes on the legacy schema until they are tuned', async () => {
    for (const slug of ['arctic-signal', 'paper-circuit', 'solar-archive']) {
      const manifest = JSON.parse(await readFile(join(themesRoot, slug, 'theme.json'), 'utf8'));
      expect(manifest.schemaVersion, slug).toBe(1);
      expect(manifest.version, slug).toBe('1.0.0');
      expect(Object.keys(manifest.palette), slug).toEqual(['background', 'surface', 'text', 'accent']);
      expect(manifest.tags, slug).not.toContain('full-workspace');
    }
  });

  test('identifies Obsidian Bloom as a full-workspace theme for the first live check', async () => {
    const catalog = await buildThemeCatalog(themesRoot);
    const theme = catalog.find((item) => item.slug === 'obsidian-bloom');

    expect(theme?.tags).toContain('full-workspace');
    expect(theme?.compatibility.status).toBe('experimental');
  });

  test('writes gallery metadata and only the declared local preview assets', async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), 'awesome-codex-catalog-'));
    tempDirs.push(outputRoot);
    const jsonPath = join(outputRoot, 'generated/themes.json');
    const publicRoot = join(outputRoot, 'public');

    const catalog = await writeThemeCatalog({ themesRoot, jsonPath, publicRoot });
    const written = JSON.parse(await readFile(jsonPath, 'utf8'));

    expect(written).toEqual(catalog);
    for (const theme of written) {
      await expect(access(join(publicRoot, theme.preview))).resolves.toBeUndefined();
      expect(theme.preview).not.toMatch(/\.\.|https?:/);
    }
  });

  test('copies a declared preview from a nested safe package path', async () => {
    const root = await mkdtemp(join(tmpdir(), 'awesome-codex-nested-preview-'));
    tempDirs.push(root);
    const customThemes = join(root, 'themes');
    const themeRoot = join(customThemes, 'nested-preview');
    await mkdir(join(themeRoot, 'assets'), { recursive: true });
    await writeFile(join(themeRoot, 'theme.json'), JSON.stringify({
      schemaVersion: 1,
      slug: 'nested-preview',
      version: '1.0.0',
      name: 'Nested Preview',
      description: 'Tests a nested preview path.',
      author: { name: 'Tests' },
      license: { code: 'MIT', artwork: 'CC0-1.0' },
      categories: ['test'],
      tags: ['nested'],
      compatibility: { platforms: ['macos'], status: 'experimental', appVersions: ['26.707.*'] },
      palette: { background: '#111111', surface: '#222222CC', text: '#FFFFFF', accent: '#00AAFF' },
      files: { css: 'theme.css', artwork: 'background.svg', preview: 'assets/preview.svg' },
    }));
    await writeFile(join(themeRoot, 'theme.css'), 'html.awesome-codex-theme { color: var(--act-text); }');
    await writeFile(join(themeRoot, 'background.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    await writeFile(join(themeRoot, 'assets/preview.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>');

    const outputRoot = join(root, 'output');
    const catalog = await writeThemeCatalog({
      themesRoot: customThemes,
      jsonPath: join(outputRoot, 'themes.json'),
      publicRoot: join(outputRoot, 'public'),
    });

    expect(catalog[0].preview).toBe('/theme-assets/nested-preview/preview.svg');
    await expect(readFile(join(outputRoot, 'public/theme-assets/nested-preview/preview.svg'), 'utf8')).resolves.toContain('<rect');
  });
});
