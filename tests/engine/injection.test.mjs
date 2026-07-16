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
      mode: 'dark',
      palette: {
        background: '#07111F',
        scrim: '#07111FD9',
        surface: '#142033CC',
        surfaceElevated: '#142033E8',
        surfaceOverlay: '#0B1220F2',
        input: '#18263BE6',
        text: '#F4F7FB',
        textSecondary: '#F4F7FBBF',
        textMuted: '#F4F7FB8F',
        textDisabled: '#F4F7FB66',
        icon: '#F4F7FB',
        iconSecondary: '#F4F7FBBF',
        iconMuted: '#F4F7FB8F',
        border: '#73E2FF38',
        borderSubtle: '#73E2FF1F',
        borderStrong: '#73E2FF70',
        accent: '#73E2FF',
        accentHover: '#A2EDFF',
        selection: '#73E2FF4D',
        focus: '#A2EDFF',
        link: '#8DE8FF',
        hover: '#73E2FF1F',
        active: '#73E2FF38',
        code: '#07101AF2',
        terminal: '#04080EF2',
        diffAdded: '#2DAA6A42',
        diffRemoved: '#FF5F5242',
        success: '#58D68D',
        warning: '#F6C85F',
        danger: '#FF6B64',
        scrollbar: '#73E2FF45',
        scrollbarHover: '#73E2FF78',
        composer: '#101B2AEF',
      },
    },
    css: '.awesome-codex-theme body { color: var(--act-text); }',
    artwork: {
      dataUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
    },
    ...overrides,
  };
}

function runtimeAdapter(overrides = {}) {
  return {
    id: 'codex-26.707',
    css: 'html.awesome-codex-theme { --adapter-sentinel: full-theme; }',
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

    const result = dom.window.eval(buildApplyExpression(runtimeTheme(), runtimeAdapter()));

    const root = dom.window.document.documentElement;
    const style = dom.window.document.getElementById(STYLE_ID);
    expect(result).toEqual({ pass: true, action: 'applied', theme: 'test-theme', adapter: 'codex-26.707' });
    expect(root.classList.contains(APPLY_MARKER)).toBe(true);
    expect(root.dataset.awesomeCodexTheme).toBe('test-theme');
    expect(root.dataset.awesomeCodexAdapter).toBe('codex-26.707');
    expect(root.style.getPropertyValue('--act-artwork')).toContain('data:image/svg+xml');
    expect(root.style.getPropertyValue('--act-surface-overlay')).toBe('#0B1220F2');
    expect(root.style.getPropertyValue('--act-text-secondary')).toBe('#F4F7FBBF');
    expect(root.style.getPropertyValue('--act-scrollbar-hover')).toBe('#73E2FF78');
    expect(root.style.getPropertyValue('--act-composer')).toBe('#101B2AEF');
    expect(style?.textContent.indexOf('--adapter-sentinel')).toBeLessThan(
      style?.textContent.indexOf('var(--act-text)') ?? -1,
    );
    expect(style?.textContent).toContain('var(--act-text)');
    expect(dom.window.document.getElementById('keep-style')).not.toBeNull();
  });

  test('is idempotent and replaces the prior payload', () => {
    const dom = createDom();
    dom.window.eval(buildApplyExpression(runtimeTheme(), runtimeAdapter()));

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
        runtimeAdapter(),
      ),
    );

    expect(dom.window.document.querySelectorAll(`#${STYLE_ID}`)).toHaveLength(1);
    expect(dom.window.document.getElementById(STYLE_ID)?.textContent).toContain('hotpink');
    expect(dom.window.document.documentElement.dataset.awesomeCodexTheme).toBe('second-theme');
  });

  test('drives the renderer color scheme from the theme mode', () => {
    const dom = createDom();
    const lightTheme = runtimeTheme({
      manifest: {
        ...runtimeTheme().manifest,
        mode: 'light',
      },
    });

    dom.window.eval(buildApplyExpression(lightTheme, runtimeAdapter()));

    expect(dom.window.document.documentElement.style.getPropertyValue('--act-color-scheme')).toBe('light');
    dom.window.eval(buildRemoveExpression());
    expect(dom.window.document.documentElement.style.getPropertyValue('--act-color-scheme')).toBe('');
  });

  test('serializes hostile-looking text as inert style text', () => {
    const dom = createDom();
    const css = '.awesome-codex-theme::before { content: "</script> `${notExecuted}"; }';

    dom.window.eval(buildApplyExpression(runtimeTheme({ css }), runtimeAdapter()));

    expect(dom.window.document.getElementById(STYLE_ID)?.textContent).toContain(css);
    expect(dom.window.notExecuted).toBeUndefined();
  });

  test('verification reports the exact active theme', () => {
    const dom = createDom();
    dom.window.eval(buildApplyExpression(runtimeTheme(), runtimeAdapter()));

    const result = dom.window.eval(buildVerificationExpression('test-theme', 'codex-26.707'));

    expect(result).toEqual({ pass: true, theme: 'test-theme', adapter: 'codex-26.707', stylePresent: true });
  });

  test('removes only project-owned state', () => {
    const dom = createDom();
    dom.window.eval(buildApplyExpression(runtimeTheme(), runtimeAdapter()));

    const result = dom.window.eval(buildRemoveExpression());

    const root = dom.window.document.documentElement;
    expect(result).toEqual({ pass: true, action: 'removed' });
    expect(root.classList.contains(APPLY_MARKER)).toBe(false);
    expect(root.classList.contains('keep-root')).toBe(true);
    expect(root.dataset.awesomeCodexTheme).toBeUndefined();
    expect(root.dataset.awesomeCodexAdapter).toBeUndefined();
    expect(root.style.getPropertyValue('--act-artwork')).toBe('');
    expect(root.style.getPropertyValue('--act-surface-overlay')).toBe('');
    expect(root.style.getPropertyValue('--act-composer')).toBe('');
    expect(dom.window.document.getElementById(STYLE_ID)).toBeNull();
    expect(dom.window.document.getElementById('keep-style')).not.toBeNull();
  });

  test('restore leaves an unrelated theme injector untouched', () => {
    const dom = createDom();
    const unrelated = dom.window.document.createElement('style');
    unrelated.id = 'cat-theme-style';
    unrelated.textContent = 'body { opacity: 1; }';
    dom.window.document.head.appendChild(unrelated);
    dom.window.eval(buildApplyExpression(runtimeTheme(), runtimeAdapter()));

    dom.window.eval(buildRemoveExpression());

    expect(dom.window.document.getElementById('cat-theme-style')?.textContent).toContain('opacity');
  });
});
