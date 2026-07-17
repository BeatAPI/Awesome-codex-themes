import { readFile } from 'node:fs/promises';

export class AdapterError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'AdapterError';
    this.code = code;
  }
}

const ADAPTERS = Object.freeze([
  Object.freeze({
    id: 'codex-26.715',
    appVersions: Object.freeze(['26.715.*']),
    file: new URL('./adapters/codex-26.707.css', import.meta.url),
  }),
  Object.freeze({
    id: 'codex-26.707',
    appVersions: Object.freeze(['26.707.*']),
    file: new URL('./adapters/codex-26.707.css', import.meta.url),
  }),
]);
const BEST_EFFORT_ADAPTER = Object.freeze({
  id: 'codex-best-effort',
  appVersions: Object.freeze(['*']),
  file: new URL('./adapters/codex-26.707.css', import.meta.url),
});

function versionMatchesRange(appVersion, range) {
  const versionParts = appVersion.split('.');
  const rangeParts = range.split('.');
  const wildcard = rangeParts.at(-1) === '*';
  const comparable = wildcard ? rangeParts.slice(0, -1) : rangeParts;
  if (!wildcard && comparable.length !== versionParts.length) return false;
  return comparable.every((part, index) => versionParts[index] === part);
}

export async function loadCodexAdapter(appVersion) {
  if (typeof appVersion !== 'string' || !/^\d+(?:\.\d+)+$/.test(appVersion)) {
    throw new AdapterError('THEME_ADAPTER_VERSION_INVALID', 'A numeric Codex app version is required.');
  }

  const verifiedAdapter = ADAPTERS.find((candidate) =>
    candidate.appVersions.some((range) => versionMatchesRange(appVersion, range)),
  );
  const adapter = verifiedAdapter ?? BEST_EFFORT_ADAPTER;

  let css;
  try {
    css = await readFile(adapter.file, 'utf8');
  } catch (error) {
    throw new AdapterError('THEME_ADAPTER_MISSING', `Built-in adapter ${adapter.id} is missing.`, {
      cause: error,
    });
  }
  if (!css.includes('html.awesome-codex-theme')) {
    throw new AdapterError('THEME_ADAPTER_INVALID', `Built-in adapter ${adapter.id} is not namespaced.`);
  }
  return {
    id: adapter.id,
    appVersions: [...adapter.appVersions],
    verified: Boolean(verifiedAdapter),
    css,
  };
}
