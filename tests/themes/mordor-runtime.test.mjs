import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { SEMANTIC_COLOR_ROLES, loadThemePackage } from '../../src/engine/theme.mjs';

const repoRoot = new URL('../..', import.meta.url).pathname;
const themeRoot = join(repoRoot, 'themes/mordor-runtime');

describe('mordor-runtime theme package', () => {
  test('loads as a complete experimental Schema 2 package', async () => {
    const theme = await loadThemePackage(themeRoot);
    expect(theme.manifest.schemaVersion).toBe(2);
    expect(theme.manifest.slug).toBe('mordor-runtime');
    expect(theme.manifest.version).toBe('0.1.1');
    expect(theme.manifest.mode).toBe('dark');
    expect(theme.manifest.compatibility).toEqual({
      platforms: ['macos'],
      status: 'experimental',
      strategy: 'best-effort-all',
      verifiedAppVersions: ['26.707.*', '26.715.*'],
    });
    expect(Object.keys(theme.manifest.palette)).toEqual(SEMANTIC_COLOR_ROLES);
    expect(theme.artwork.bytes).toBeLessThanOrEqual(700 * 1024);
  });

  test('declares a bounded original component-asset system', async () => {
    const theme = await loadThemePackage(themeRoot);
    const assets = Object.entries(theme.assets);
    expect(assets.length).toBeGreaterThanOrEqual(5);
    expect(assets.length).toBeLessThanOrEqual(16);
    expect(theme.manifest.files.assets).toHaveProperty('forge-notch');
    for (const [name, asset] of assets) {
      expect(name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(asset.bytes).toBeLessThanOrEqual(256 * 1024);
      expect(asset.dataUrl).toMatch(/^data:image\//);
    }
  });

  test('scopes visual rules to this theme and excludes the Satoru Gojo visual language', async () => {
    const theme = await loadThemePackage(themeRoot);
    expect(theme.css).toContain("html.awesome-codex-theme[data-awesome-codex-theme=\"mordor-runtime\"]");
    expect(theme.css).toContain('--batch-theme-signature: "mordor-runtime"');
    expect(theme.css).toContain('--act-asset-forge-notch');
    expect(theme.css).not.toMatch(/six-eyes|blindfold|send-infinity|limitless-violet|lavender|satoru-gojo/i);
    expect(theme.css).not.toMatch(/(^|[^-])url\s*\(/i);
  });

  test('records project asset sources without an internal-only restriction', async () => {
    const notice = await readFile(join(themeRoot, 'ASSET_LICENSE.md'), 'utf8');
    expect(notice).toContain('Asset identifier: `PROJECT-ASSET`');
    expect(notice).not.toMatch(/internal prototype|not approved for public release|must be replaced/i);
    expect(notice).toContain('09-nazgul-ringwraiths.png');
    expect(notice).toContain('09-nazgul-standard-codex-imagegen-v1.png');
  });
});
