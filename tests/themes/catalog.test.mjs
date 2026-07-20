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
  test('loads only complete runnable release themes', async () => {
    const catalog = await buildThemeCatalog(themesRoot);

    expect(catalog.map((theme) => theme.slug)).toEqual([
      'castle-archive',
      'foundling-garden',
      'grand-line',
      'mordor-runtime',
      'new-world-studio',
      'night-city',
      'overworld-realms',
      'saiyan-ukiyoe',
      'satoru-gojo',
      'slingshot-lab',
      'symbiote-sumi-e',
      'zaun-workshop',
    ]);
    expect(catalog).toHaveLength(12);
    expect(catalog.every((theme) => theme.compatibility.status === 'experimental')).toBe(true);
    expect(catalog.every((theme) => theme.command.endsWith(' --takeover-at-login'))).toBe(true);
    expect(catalog.every((theme) => theme.preview.startsWith('/theme-assets/'))).toBe(true);
  });

  test('publishes English-first Satoru Gojo metadata for a flagship experience', async () => {
    const catalog = await buildThemeCatalog(themesRoot);
    const theme = catalog.find((item) => item.slug === 'satoru-gojo');

    expect(theme?.name).toBe('Satoru Gojo');
    expect(theme?.nativeName).toBe('五条 悟');
    expect(theme?.nativeLocale).toBe('ja-JP');
    expect(theme?.tags).toContain('featured');
    expect(theme?.tags).toContain('full-workspace');
    expect(theme?.license.artwork).toBe('PROJECT-ASSET');
    expect(theme?.experience).toEqual(
      expect.objectContaining({
        brand: 'LIMITLESS',
        status: 'LIMITLESS // ACTIVE',
        chrome: true,
      }),
    );
  });

  test('keeps exactly one Featured theme and project assets across the collection', async () => {
    const catalog = await buildThemeCatalog(themesRoot);

    expect(catalog.filter((theme) => theme.tags.includes('featured')).map((theme) => theme.slug)).toEqual([
      'satoru-gojo',
    ]);
    expect(catalog.every((theme) => theme.license.artwork === 'PROJECT-ASSET')).toBe(true);
  });

  test('writes gallery metadata and only the declared local preview assets', async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), 'awesome-codex-catalog-'));
    tempDirs.push(outputRoot);
    const jsonPath = join(outputRoot, 'generated/themes.json');
    const publicRoot = join(outputRoot, 'public');
    const stalePreview = join(publicRoot, 'theme-assets/removed-theme/preview.svg');
    await mkdir(join(publicRoot, 'theme-assets/removed-theme'), { recursive: true });
    await writeFile(stalePreview, '<svg xmlns="http://www.w3.org/2000/svg"/>');

    const catalog = await writeThemeCatalog({ themesRoot, jsonPath, publicRoot });
    const written = JSON.parse(await readFile(jsonPath, 'utf8'));

    expect(written).toEqual(catalog);
    for (const theme of written) {
      await expect(access(join(publicRoot, theme.preview))).resolves.toBeUndefined();
      expect(theme.preview).not.toMatch(/\.\.|https?:/);
    }
    await expect(access(stalePreview)).rejects.toThrow();
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
      version: '1.1.0',
      name: 'Nested Preview',
      nativeName: 'プレビュー',
      nativeLocale: 'ja-JP',
      description: 'Tests a nested preview path.',
      author: { name: 'Tests' },
      license: { code: 'MIT', artwork: 'CC0-1.0' },
      categories: ['test'],
      tags: ['nested'],
      compatibility: {
        platforms: ['macos'],
        status: 'experimental',
        strategy: 'best-effort-all',
        verifiedAppVersions: ['26.707.*', '26.715.*'],
      },
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
    expect(catalog[0].nativeName).toBe('プレビュー');
    expect(catalog[0].nativeLocale).toBe('ja-JP');
    await expect(readFile(join(outputRoot, 'public/theme-assets/nested-preview/preview.svg'), 'utf8')).resolves.toContain('<rect');
  });
});
