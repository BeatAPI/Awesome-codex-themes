import { access, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { buildThemeCatalog } from '../../scripts/catalog.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');

describe('twelve-theme launch collection', () => {
  test('ships exactly twelve runnable packages with paired README marketing assets', async () => {
    const catalog = await buildThemeCatalog(join(repoRoot, 'themes'));

    expect(catalog).toHaveLength(12);
    expect(catalog.filter((theme) => theme.tags.includes('featured')).map((theme) => theme.slug)).toEqual([
      'satoru-gojo',
    ]);

    for (const theme of catalog) {
      await expect(access(join(repoRoot, 'themes', theme.slug, 'background.jpg'))).resolves.toBeUndefined();
      await expect(access(join(repoRoot, 'docs', 'gallery', theme.slug, 'marketing.jpg'))).resolves.toBeUndefined();
    }
  });

  test('contains no legacy example catalog or temporary intake slots', async () => {
    const roots = (await readdir(repoRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    expect(roots).not.toContain('examples');
    expect(roots).not.toContain('theme-slots');
  });
});
