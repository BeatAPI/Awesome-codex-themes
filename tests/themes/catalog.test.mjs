import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

import { buildThemeCatalog, writeThemeCatalog } from '../../scripts/catalog.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');
const themesRoot = join(repoRoot, 'themes');
const tempDirs = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('theme catalog', () => {
  test('loads the four original launch themes in deterministic order', async () => {
    const catalog = await buildThemeCatalog(themesRoot);

    expect(catalog.map((theme) => theme.slug)).toEqual([
      'arctic-signal',
      'obsidian-bloom',
      'paper-circuit',
      'solar-archive',
    ]);
    expect(catalog.every((theme) => theme.compatibility.status === 'experimental')).toBe(true);
    expect(catalog.every((theme) => theme.command.startsWith('awesome-codex-themes start '))).toBe(true);
    expect(catalog.every((theme) => theme.preview.startsWith('/theme-assets/'))).toBe(true);
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
});
