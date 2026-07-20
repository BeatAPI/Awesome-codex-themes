import { describe, expect, test } from 'vitest';

import { AdapterError, loadCodexAdapter } from '../../src/engine/adapter.mjs';

describe('loadCodexAdapter', () => {
  test('loads the built-in adapter for the supported Codex version family', async () => {
    const adapter = await loadCodexAdapter('26.707.72221');

    expect(adapter.id).toBe('codex-26.707');
    expect(adapter.appVersions).toEqual(['26.707.*']);
    expect(adapter.verified).toBe(true);
    expect(adapter.css.length).toBeGreaterThan(4_000);
  });

  test('loads a separately identified adapter for the live-verified 26.715 family', async () => {
    const adapter = await loadCodexAdapter('26.715.21425');

    expect(adapter.id).toBe('codex-26.715');
    expect(adapter.appVersions).toEqual(['26.715.*']);
    expect(adapter.verified).toBe(true);
    expect(adapter.css).toContain('.composer-surface-chrome');
  });

  test('contains a representative rule for every full-theme coverage group', async () => {
    const { css } = await loadCodexAdapter('26.707.72221');
    const coverage = {
      canvas: ['--act-artwork', '#root'],
      surfaces: ['--color-token-main-surface-primary', '--color-background-elevated-primary'],
      text: ['--color-token-foreground', '--color-text-foreground-secondary'],
      icons: ['--color-token-icon-foreground', '--color-icon-secondary'],
      borders: ['--color-token-border-default', '--color-border-focus'],
      menus: ['[role="menu"]', '[role="listbox"]'],
      inputs: ['--color-token-input-background', 'textarea'],
      codeAndDiff: ['--color-token-text-code-block-background', '--color-token-diff-editor-inserted-line-background'],
      hoverAndActive: ['--color-token-list-hover-background', '--color-background-button-secondary-hover'],
      selection: ['::selection', '--color-token-editor-selection-background'],
      scrollbars: ['scrollbar-color', '::-webkit-scrollbar-thumb'],
      composer: ['.composer-surface-chrome', '[data-testid="composer-send-button"]'],
      dialogs: ['[role="dialog"]', '[role="tooltip"]'],
      focus: [':focus-visible', '--color-token-focus-border'],
    };

    for (const [group, markers] of Object.entries(coverage)) {
      expect(markers.every((marker) => css.includes(marker)), `missing ${group}`).toBe(true);
    }
  });

  test('does not force visible borders onto every native interactive control', async () => {
    const { css } = await loadCodexAdapter('26.707.72221');

    expect(css).not.toMatch(
      /html\.awesome-codex-theme\s+:is\(button,\s*\[role="button"\],\s*a\)\s*\{[^}]*border-color/s,
    );
    expect(css).not.toMatch(
      /html\.awesome-codex-theme\s+:is\(button,\s*\[role="button"\],\s*a\):hover\s*\{[^}]*border-color/s,
    );
  });

  test('styles the semantic primary composer control with contrasting foreground and background', async () => {
    const { css } = await loadCodexAdapter('26.715.31925');

    expect(css).toContain('button[data-awesome-codex-composer-control="primary"]');
    expect(css).toMatch(
      /button\[data-awesome-codex-composer-control="primary"\][^}]*\{[^}]*color:\s*var\(--act-background\)\s*!important;[^}]*background:\s*var\(--act-accent\)\s*!important;/s,
    );
  });

  test('uses the shared mapping as a best-effort adapter for every numeric version', async () => {
    await expect(loadCodexAdapter('26.716.1')).resolves.toEqual(
      expect.objectContaining({
        id: 'codex-best-effort',
        appVersions: ['*'],
        verified: false,
        css: expect.stringContaining('.composer-surface-chrome'),
      }),
    );
  });

  test('rejects malformed versions with a typed adapter error', async () => {
    await expect(loadCodexAdapter('latest')).rejects.toBeInstanceOf(AdapterError);
  });
});
