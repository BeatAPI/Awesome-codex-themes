export const STYLE_ID = 'awesome-codex-theme-style';
export const APPLY_MARKER = 'awesome-codex-theme';

const OWNED_VARIABLES = [
  '--act-artwork',
  '--act-background',
  '--act-surface',
  '--act-text',
  '--act-accent',
];

function serializeForExpression(value) {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}

function runtimePayload(theme) {
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
  return {
    slug: manifest.slug,
    css,
    artworkDataUrl: artwork.dataUrl,
    palette: manifest.palette,
  };
}

export function buildApplyExpression(theme) {
  const payload = serializeForExpression(runtimePayload(theme));
  return `(() => {
    const payload = ${payload};
    const root = document.documentElement;
    if (!root || !document.head) return { pass: false, action: 'applied', theme: payload.slug };

    let style = document.getElementById(${serializeForExpression(STYLE_ID)});
    if (!style) {
      style = document.createElement('style');
      style.id = ${serializeForExpression(STYLE_ID)};
      style.dataset.owner = 'awesome-codex-themes';
      document.head.appendChild(style);
    }
    style.textContent = payload.css;

    root.classList.add(${serializeForExpression(APPLY_MARKER)});
    root.dataset.awesomeCodexTheme = payload.slug;
    root.style.setProperty('--act-artwork', 'url("' + payload.artworkDataUrl + '")');
    root.style.setProperty('--act-background', payload.palette.background);
    root.style.setProperty('--act-surface', payload.palette.surface);
    root.style.setProperty('--act-text', payload.palette.text);
    root.style.setProperty('--act-accent', payload.palette.accent);

    return { pass: true, action: 'applied', theme: payload.slug };
  })()`;
}

export function buildVerificationExpression(expectedSlug) {
  const slug = serializeForExpression(expectedSlug);
  return `(() => {
    const root = document.documentElement;
    const stylePresent = Boolean(document.getElementById(${serializeForExpression(STYLE_ID)}));
    const theme = root?.dataset?.awesomeCodexTheme ?? null;
    return {
      pass: Boolean(root?.classList?.contains(${serializeForExpression(APPLY_MARKER)}) && stylePresent && theme === ${slug}),
      theme,
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
      for (const variable of ${variables}) root.style.removeProperty(variable);
    }
    return {
      pass: !document.getElementById(${serializeForExpression(STYLE_ID)}) && !root?.classList?.contains(${serializeForExpression(APPLY_MARKER)}),
      action: 'removed',
    };
  })()`;
}
