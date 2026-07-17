import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { loadThemePackage, SEMANTIC_COLOR_ROLES } from '../../src/engine/theme.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');
const themeRoot = join(repoRoot, 'themes/satoru-gojo');

describe('Satoru Gojo flagship theme', () => {
  test('ships a complete schema-v2 experience manifest', async () => {
    const loaded = await loadThemePackage(themeRoot);

    expect(loaded.manifest.slug).toBe('satoru-gojo');
    expect(loaded.manifest.version).toBe('1.2.0');
    expect(loaded.manifest.name).toBe('Satoru Gojo');
    expect(loaded.manifest.nativeName).toBe('五条 悟');
    expect(loaded.manifest.nativeLocale).toBe('ja-JP');
    expect(loaded.manifest.mode).toBe('light');
    expect(loaded.manifest.compatibility.strategy).toBe('best-effort-all');
    expect(loaded.manifest.compatibility.verifiedAppVersions).toEqual(['26.707.*', '26.715.*']);
    expect(Object.keys(loaded.manifest.palette)).toEqual(SEMANTIC_COLOR_ROLES);
    expect(loaded.manifest.tags).toEqual(
      expect.arrayContaining(['featured', 'full-workspace', 'composer', 'editorial']),
    );
    expect(loaded.manifest.experience).toEqual({
      brand: 'LIMITLESS',
      eyebrow: 'SIX EYES',
      headline: 'CODEX THEME SYSTEM',
      tagline: 'Editorial workspace protocol.',
      status: 'LIMITLESS // ACTIVE',
      signature: 'SATORU GOJO // 五条 悟',
      chrome: true,
    });
    expect(loaded.manifest.files.assets).toEqual({
      'six-eyes-emblem': 'assets/six-eyes-emblem.png',
      'send-infinity': 'assets/send-infinity.png',
      'panel-reticle': 'assets/panel-reticle.png',
      'blindfold-stripe': 'assets/blindfold-stripe.png',
      'six-dot-sequence': 'assets/six-dot-sequence.png',
      'workspace-panel-safe': 'assets/workspace-panel-safe.jpg',
    });
    expect(Object.keys(loaded.assets)).toEqual([
      'six-eyes-emblem',
      'send-infinity',
      'panel-reticle',
      'blindfold-stripe',
      'six-dot-sequence',
      'workspace-panel-safe',
    ]);
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
      '[data-awesome-codex-artifact-panel="true"]',
      '[data-awesome-codex-artifact-header="true"]',
      '[data-awesome-codex-panel-more="true"]',
      '[data-awesome-codex-completed-summary="true"]',
      '[data-awesome-codex-activity-item="true"]',
      '[data-awesome-codex-header-control="true"]',
      '[data-awesome-codex-project-row="true"]',
      '[data-awesome-codex-task-row="true"]',
      '[data-awesome-codex-sidebar-brand="true"]',
      '[data-awesome-codex-sidebar-nav]',
      '[data-awesome-codex-domain-header="true"]',
      '[data-awesome-codex-domain-id]',
      '[data-awesome-codex-account-trigger="true"]',
      '[data-awesome-codex-account-identity="true"]',
      '[data-awesome-codex-help-trigger="true"]',
      '[data-awesome-codex-home-prompt="true"]',
      '[data-awesome-codex-domain-marker="true"]',
      '[data-awesome-codex-composer-control="attachment"]',
      '[data-awesome-codex-composer-control="access"]',
      '[data-awesome-codex-composer-control="model"]',
      '[data-awesome-codex-composer-control="dictation"]',
      '[data-awesome-codex-composer-control="primary"]',
      '[data-awesome-codex-surface="plugins"]',
      '[data-awesome-codex-plugin-search="true"]',
      '[data-awesome-codex-plugin-tab="true"]',
      '[data-awesome-codex-plugin-section-header="true"]',
      '[data-awesome-codex-plugin-installed="true"]',
      '[data-awesome-codex-plugin-card="true"]',
      '[data-awesome-codex-plugin-icon="true"]',
      '[data-awesome-codex-plugin-action="menu"]',
      '[data-awesome-codex-plugin-action="install"]',
      '[data-awesome-codex-surface="scheduled"]',
      '[data-awesome-codex-surface="sites"]',
      '[data-awesome-codex-surface="pull-requests"]',
      '[data-awesome-codex-collection-search="true"]',
      '[data-awesome-codex-collection-tab="true"]',
      '[data-awesome-codex-collection-row="true"]',
      '[data-awesome-codex-collection-empty="true"]',
      '[data-awesome-codex-collection-status="true"]',
      '[data-awesome-codex-collection-action="primary"]',
      '--act-asset-six-eyes-emblem',
      '--act-asset-send-infinity',
      '--act-asset-panel-reticle',
      '--act-asset-blindfold-stripe',
      '--act-asset-six-dot-sequence',
      '--act-asset-workspace-panel-safe',
      'DOMAIN CONTROL DECK // SIX EYES',
      'LIMITLESS // SIX EYES',
      '[data-awesome-codex-surface="workspace"] #awesome-codex-theme-chrome .act-experience__status',
      '.act-experience__brand',
      '.act-experience__orbit',
      '.act-experience__particle',
      '@media (prefers-reduced-motion: reduce)',
    ]) {
      expect(css, marker).toContain(marker);
    }
  });

  test('keeps the flagship artwork and ice-blue atmosphere visible in active workspaces', async () => {
    const css = await readFile(join(themeRoot, 'theme.css'), 'utf8');

    for (const marker of [
      '[data-awesome-codex-surface="workspace"] #root',
      '--limitless-workspace-art-opacity',
      'var(--act-artwork)',
      '[data-awesome-codex-surface="workspace"] .thread-scroll-container',
      '[data-awesome-codex-surface="workspace"] .composer-surface-chrome',
      '--limitless-radius-card',
      'html.electron-dark.awesome-codex-theme',
    ]) {
      expect(css, marker).toContain(marker);
    }

    expect(css).not.toContain('.app-shell-main-content-top-fade,\n  header');
    expect(css).not.toContain('.dialog-layout,\n  .bg-token-dropdown-background');
    expect(css).not.toContain('background-blend-mode');
    expect(css).toContain(
      '[class*="bg-token-foreground/5"]:not([data-awesome-codex-header-control="true"])',
    );
    expect(css).not.toMatch(
      /:is\(\s*button,\s*\[role="button"\],\s*a\s*\):hover\s*\{[^}]*border-color/s,
    );
    expect(css).toMatch(
      /\[data-awesome-codex-plugin-card="true"\][^{]*\{[^}]*border:\s*0\s*!important/s,
    );
    expect(css).toMatch(
      /\[data-awesome-codex-composer-control="access"\]::before\s*\{[^}]*border:\s*0\s*!important/s,
    );
    expect(css).toMatch(
      /\.act-experience__status\s*\{[^}]*border-radius:\s*0\s*;/s,
    );
    expect(css).toMatch(
      /\[data-awesome-codex-artifact-panel="true"\]\s*\{[^}]*border:\s*0\s*!important/s,
    );
    expect(css).toMatch(
      /\[data-awesome-codex-domain-marker="true"\]\s*\{[^}]*margin-inline:\s*0\.16em/s,
    );
    expect(css).toMatch(
      /\[data-awesome-codex-sidebar-brand="true"\]\s*\{[^}]*var\(--act-asset-six-eyes-emblem\)/s,
    );
    expect(css).toMatch(
      /\[data-awesome-codex-account-identity="true"\]\s*\{[^}]*var\(--act-asset-six-dot-sequence\)/s,
    );
    expect(css).toMatch(
      /:has\(\[data-awesome-codex-artifact-panel="true"\]\)\s*#root::before\s*\{[^}]*background-image:\s*var\(--act-asset-workspace-panel-safe\)\s*!important;[^}]*background-position:\s*center\s*!important;[^}]*background-size:\s*cover\s*!important;/s,
    );
    expect(css).toMatch(
      /\[data-awesome-codex-domain-header="true"\]\s*>\s*svg\s*\{[^}]*width:\s*11px\s*!important;[^}]*margin-left:\s*2px\s*!important;/s,
    );
    expect(css).toMatch(
      /\[data-awesome-codex-task-row="true"\]:has\(\.animate-spin\)::after\s*\{[^}]*display:\s*none;/s,
    );
    expect(css).toMatch(
      /\[data-awesome-codex-domain-marker="true"\]\s*\{[^}]*margin-inline:\s*0\.16em\s*!important;[^}]*padding:\s*0\.06em 0\.32em 0\.06em 0\.58em\s*!important;/s,
    );
    expect(css).toContain('background-size: auto, auto 205%');
    expect(css).not.toMatch(
      /\[class~="bg-token-list-hover-background"\]\s*\{[^}]*var\(--act-asset-blindfold-stripe\)/s,
    );
  });

  test('ships bounded transparent component assets for the editorial system', async () => {
    const loaded = await loadThemePackage(themeRoot);

    for (const [name, asset] of Object.entries(loaded.assets)) {
      expect(asset.mime, name).toMatch(/^image\/(?:png|jpeg)$/);
      expect(asset.bytes, name).toBeGreaterThan(1_000);
      expect(asset.bytes, name).toBeLessThan(256 * 1024);
      expect(asset.dataUrl, name).toMatch(/^data:image\/(?:png|jpeg);base64,/);
    }
  });

  test('ships the approved public project artwork without prototype restrictions', async () => {
    const [license, backgroundInfo, previewInfo] = await Promise.all([
      readFile(join(themeRoot, 'ASSET_LICENSE.md'), 'utf8'),
      stat(join(themeRoot, 'background.jpg')),
      stat(join(themeRoot, 'preview.png')),
    ]);

    expect(license).toContain('PROJECT-ASSET');
    expect(license).not.toMatch(/private fan|prototype-reference-only|not covered|must be replaced|not offered/i);
    expect(backgroundInfo.size).toBeGreaterThan(100_000);
    expect(backgroundInfo.size).toBeLessThan(700 * 1024);
    expect(previewInfo.size).toBeGreaterThan(100_000);
  });

  test('keeps internal iteration labels out of public package text', async () => {
    const loaded = await loadThemePackage(themeRoot);
    const license = await readFile(join(themeRoot, 'ASSET_LICENSE.md'), 'utf8');
    const publicText = JSON.stringify(loaded.manifest) + license;

    expect(publicText).not.toMatch(/\bV5(?:\.6)?\b/i);
  });
});
