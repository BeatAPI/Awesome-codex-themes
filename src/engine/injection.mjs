import { SEMANTIC_COLOR_ROLES } from './theme.mjs';

export const STYLE_ID = 'awesome-codex-theme-style';
export const APPLY_MARKER = 'awesome-codex-theme';

function roleToVariable(role) {
  return `--act-${role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

export const PALETTE_VARIABLES = Object.freeze(
  Object.fromEntries(SEMANTIC_COLOR_ROLES.map((role) => [role, roleToVariable(role)])),
);

const OWNED_VARIABLES = Object.freeze([
  '--act-artwork',
  '--act-color-scheme',
  ...Object.values(PALETTE_VARIABLES),
]);

function serializeForExpression(value) {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}

function runtimePayload(theme, adapter) {
  const { manifest, css, artwork } = theme ?? {};
  if (
    !manifest ||
    typeof manifest.slug !== 'string' ||
    !manifest.palette ||
    typeof css !== 'string' ||
    typeof artwork?.dataUrl !== 'string'
  ) {
    throw new TypeError('A fully loaded theme package is required.');
  }
  if (
    !adapter ||
    typeof adapter.id !== 'string' ||
    adapter.id.trim() === '' ||
    typeof adapter.css !== 'string' ||
    adapter.css.trim() === ''
  ) {
    throw new TypeError('A fully loaded Codex adapter is required.');
  }
  if (!['dark', 'light', 'system'].includes(manifest.mode)) {
    throw new TypeError('A validated theme mode is required.');
  }
  const variables = Object.fromEntries(
    Object.entries(PALETTE_VARIABLES).map(([role, variable]) => {
      const value = manifest.palette[role];
      if (typeof value !== 'string' || value === '') {
        throw new TypeError(`Theme palette role is missing: ${role}`);
      }
      return [variable, value];
    }),
  );
  return {
    slug: manifest.slug,
    colorScheme: manifest.mode === 'system' ? 'light dark' : manifest.mode,
    css,
    adapterId: adapter.id,
    adapterCss: adapter.css,
    artworkDataUrl: artwork.dataUrl,
    variables,
  };
}

export function buildApplyExpression(theme, adapter) {
  const payload = serializeForExpression(runtimePayload(theme, adapter));
  return `(() => {
    const payload = ${payload};
    const root = document.documentElement;
    if (!root || !document.head) return { pass: false, action: 'applied', theme: payload.slug, adapter: payload.adapterId };

    let style = document.getElementById(${serializeForExpression(STYLE_ID)});
    if (!style) {
      style = document.createElement('style');
      style.id = ${serializeForExpression(STYLE_ID)};
      style.dataset.owner = 'awesome-codex-themes';
      document.head.appendChild(style);
    }
    style.dataset.adapter = payload.adapterId;
    style.textContent = payload.adapterCss + '\\n\\n' + payload.css;

    root.classList.add(${serializeForExpression(APPLY_MARKER)});
    root.dataset.awesomeCodexTheme = payload.slug;
    root.dataset.awesomeCodexAdapter = payload.adapterId;
    root.style.setProperty('--act-artwork', 'url("' + payload.artworkDataUrl + '")');
    root.style.setProperty('--act-color-scheme', payload.colorScheme);
    for (const [variable, value] of Object.entries(payload.variables)) {
      root.style.setProperty(variable, value);
    }

    return { pass: true, action: 'applied', theme: payload.slug, adapter: payload.adapterId };
  })()`;
}

export function buildVerificationExpression(expectedSlug, expectedAdapterId) {
  const slug = serializeForExpression(expectedSlug);
  const adapterId = serializeForExpression(expectedAdapterId);
  return `(() => {
    const root = document.documentElement;
    const stylePresent = Boolean(document.getElementById(${serializeForExpression(STYLE_ID)}));
    const theme = root?.dataset?.awesomeCodexTheme ?? null;
    const adapter = root?.dataset?.awesomeCodexAdapter ?? null;
    return {
      pass: Boolean(root?.classList?.contains(${serializeForExpression(APPLY_MARKER)}) && stylePresent && theme === ${slug} && adapter === ${adapterId}),
      theme,
      adapter,
      stylePresent,
    };
  })()`;
}

export function buildRemoveExpression() {
  const variables = serializeForExpression(OWNED_VARIABLES);
  return `(() => {
    const root = document.documentElement;
    document.getElementById(${serializeForExpression(STYLE_ID)})?.remove();
    if (root) {
      root.classList.remove(${serializeForExpression(APPLY_MARKER)});
      delete root.dataset.awesomeCodexTheme;
      delete root.dataset.awesomeCodexAdapter;
      for (const variable of ${variables}) root.style.removeProperty(variable);
    }
    return {
      pass: !document.getElementById(${serializeForExpression(STYLE_ID)}) && !root?.classList?.contains(${serializeForExpression(APPLY_MARKER)}),
      action: 'removed',
    };
  })()`;
}
