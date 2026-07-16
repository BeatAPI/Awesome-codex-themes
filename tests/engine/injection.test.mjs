import { JSDOM } from 'jsdom';
import { describe, expect, test } from 'vitest';

import {
  APPLY_MARKER,
  STYLE_ID,
  buildApplyExpression,
  buildRemoveExpression,
  buildVerificationExpression,
} from '../../src/engine/injection.mjs';

function runtimeTheme(overrides = {}) {
  return {
    manifest: {
      slug: 'test-theme',
      name: 'Test Theme',
      palette: {
        background: '#07111F',
        surface: '#142033CC',
        text: '#F4F7FB',
        accent: '#73E2FF',
      },
    },
    css: '.awesome-codex-theme body { color: var(--act-text); }',
    artwork: {
      dataUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
    },
    ...overrides,
  };
}

function createDom() {
  return new JSDOM(
    '<!doctype html><html class="electron-dark keep-root"><head><style id="keep-style">body{margin:0}</style></head><body></body></html>',
    { runScripts: 'outside-only', url: 'app://-/index.html' },
  );
}

describe('theme injection expressions', () => {
  test('applies a namespaced style and root marker', () => {
    const dom = createDom();

    const result = dom.window.eval(buildApplyExpression(runtimeTheme()));

    const root = dom.window.document.documentElement;
    const style = dom.window.document.getElementById(STYLE_ID);
    expect(result).toEqual({ pass: true, action: 'applied', theme: 'test-theme' });
    expect(root.classList.contains(APPLY_MARKER)).toBe(true);
    expect(root.dataset.awesomeCodexTheme).toBe('test-theme');
    expect(root.style.getPropertyValue('--act-artwork')).toContain('data:image/svg+xml');
    expect(style?.textContent).toContain('var(--act-text)');
    expect(dom.window.document.getElementById('keep-style')).not.toBeNull();
  });

  test('is idempotent and replaces the prior payload', () => {
    const dom = createDom();
    dom.window.eval(buildApplyExpression(runtimeTheme()));

    dom.window.eval(
      buildApplyExpression(
        runtimeTheme({
          manifest: {
            ...runtimeTheme().manifest,
            slug: 'second-theme',
            name: 'Second Theme',
          },
          css: '.awesome-codex-theme body { color: hotpink; }',
        }),
      ),
    );

    expect(dom.window.document.querySelectorAll(`#${STYLE_ID}`)).toHaveLength(1);
    expect(dom.window.document.getElementById(STYLE_ID)?.textContent).toContain('hotpink');
    expect(dom.window.document.documentElement.dataset.awesomeCodexTheme).toBe('second-theme');
  });

  test('serializes hostile-looking text as inert style text', () => {
    const dom = createDom();
    const css = '.awesome-codex-theme::before { content: "</script> `${notExecuted}"; }';

    dom.window.eval(buildApplyExpression(runtimeTheme({ css })));

    expect(dom.window.document.getElementById(STYLE_ID)?.textContent).toBe(css);
    expect(dom.window.notExecuted).toBeUndefined();
  });

  test('verification reports the exact active theme', () => {
    const dom = createDom();
    dom.window.eval(buildApplyExpression(runtimeTheme()));

    const result = dom.window.eval(buildVerificationExpression('test-theme'));

    expect(result).toEqual({ pass: true, theme: 'test-theme', stylePresent: true });
  });

  test('removes only project-owned state', () => {
    const dom = createDom();
    dom.window.eval(buildApplyExpression(runtimeTheme()));

    const result = dom.window.eval(buildRemoveExpression());

    const root = dom.window.document.documentElement;
    expect(result).toEqual({ pass: true, action: 'removed' });
    expect(root.classList.contains(APPLY_MARKER)).toBe(false);
    expect(root.classList.contains('keep-root')).toBe(true);
    expect(root.dataset.awesomeCodexTheme).toBeUndefined();
    expect(root.style.getPropertyValue('--act-artwork')).toBe('');
    expect(dom.window.document.getElementById(STYLE_ID)).toBeNull();
    expect(dom.window.document.getElementById('keep-style')).not.toBeNull();
  });
});
