import { describe, expect, test } from 'vitest';

import { AdapterError, loadCodexAdapter } from '../../src/engine/adapter.mjs';

describe('loadCodexAdapter', () => {
  test('loads the built-in adapter for the supported Codex version family', async () => {
    const adapter = await loadCodexAdapter('26.707.72221');

    expect(adapter.id).toBe('codex-26.707');
    expect(adapter.appVersions).toEqual(['26.707.*']);
    expect(adapter.css.length).toBeGreaterThan(4_000);
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

  test('fails closed when no adapter declares the app version', async () => {
    await expect(loadCodexAdapter('26.708.1')).rejects.toEqual(
      expect.objectContaining({ code: 'THEME_ADAPTER_UNSUPPORTED' }),
    );
  });

  test('rejects malformed versions with a typed adapter error', async () => {
    await expect(loadCodexAdapter('latest')).rejects.toBeInstanceOf(AdapterError);
  });
});
