import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import { loadThemePackage } from '../src/engine/theme.mjs';

export async function buildThemeCatalog(themesRoot) {
  const entries = await readdir(themesRoot, { withFileTypes: true });
  const catalog = [];

  for (const entry of entries.filter((item) => item.isDirectory()).sort((left, right) => left.name.localeCompare(right.name))) {
    const loaded = await loadThemePackage(join(themesRoot, entry.name));
    const manifest = loaded.manifest;
    if (manifest.slug !== entry.name) {
      throw new Error(`Theme directory must match manifest slug: ${entry.name}`);
    }
    catalog.push({
      slug: manifest.slug,
      version: manifest.version,
      name: manifest.name,
      description: manifest.description,
      author: manifest.author,
      license: manifest.license,
      categories: manifest.categories,
      tags: manifest.tags,
      compatibility: manifest.compatibility,
      mode: manifest.mode,
      palette: manifest.palette,
      ...(manifest.experience ? { experience: manifest.experience } : {}),
      preview: `/theme-assets/${manifest.slug}/${basename(manifest.files.preview)}`,
      command: `awesome-codex-themes start ${manifest.slug}`,
    });
  }

  return catalog;
}

export async function writeThemeCatalog({ themesRoot, jsonPath, publicRoot }) {
  const catalog = await buildThemeCatalog(themesRoot);
  await mkdir(dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(catalog, null, 2)}\n`);

  for (const theme of catalog) {
    const previewName = theme.preview.split('/').at(-1);
    const destination = join(publicRoot, 'theme-assets', theme.slug, previewName);
    const loaded = await loadThemePackage(join(themesRoot, theme.slug));
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(loaded.previewPath, destination);
  }

  return catalog;
}
