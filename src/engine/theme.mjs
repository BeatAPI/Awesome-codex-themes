import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, resolve, sep } from 'node:path';

export const THEME_SCHEMA_VERSION = 2;
export const SUPPORTED_THEME_SCHEMA_VERSIONS = Object.freeze([1, 2]);
export const SEMANTIC_COLOR_ROLES = Object.freeze([
  'background',
  'scrim',
  'surface',
  'surfaceElevated',
  'surfaceOverlay',
  'input',
  'text',
  'textSecondary',
  'textMuted',
  'textDisabled',
  'icon',
  'iconSecondary',
  'iconMuted',
  'border',
  'borderSubtle',
  'borderStrong',
  'accent',
  'accentHover',
  'selection',
  'focus',
  'link',
  'hover',
  'active',
  'code',
  'terminal',
  'diffAdded',
  'diffRemoved',
  'success',
  'warning',
  'danger',
  'scrollbar',
  'scrollbarHover',
  'composer',
]);
export const DEFAULT_MAX_ASSET_BYTES = 10 * 1024 * 1024;
export const DEFAULT_MAX_RUNTIME_ARTWORK_BYTES = 700 * 1024;
export const DEFAULT_MAX_CSS_BYTES = 256 * 1024;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const APP_VERSION_RANGE_PATTERN = /^\d+(?:\.\d+)+(?:\.\*)?$/;
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?$/;
const SUPPORTED_PLATFORMS = new Set(['macos']);
const SUPPORTED_STATUS = new Set(['experimental', 'verified']);
const SUPPORTED_MODES = new Set(['dark', 'light', 'system']);
const EXPERIENCE_FIELD_LIMITS = Object.freeze({
  brand: 48,
  eyebrow: 48,
  headline: 80,
  tagline: 160,
  status: 48,
  signature: 80,
});

export class ThemeValidationError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'ThemeValidationError';
    this.code = code;
  }
}

function fail(code, message, options) {
  throw new ThemeValidationError(code, message, options);
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail('THEME_FIELD_REQUIRED', `${field} must be a non-empty string.`);
  }
  return value.trim();
}

function requireBoundedString(value, field, maxLength) {
  const normalized = requireString(value, field);
  if (normalized.length > maxLength) {
    fail('THEME_FIELD_TOO_LONG', `${field} must be ${maxLength} characters or fewer.`);
  }
  return normalized;
}

function requireStringArray(value, field) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || !item.trim())) {
    fail('THEME_FIELD_REQUIRED', `${field} must be a non-empty string array.`);
  }
  return [...new Set(value.map((item) => item.trim().toLowerCase()))];
}

function validateLocalPath(value, field) {
  const path = requireString(value, field);
  if (
    isAbsolute(path) ||
    path.includes('\\') ||
    path.includes('\0') ||
    /^[a-z][a-z\d+.-]*:/i.test(path) ||
    path.split('/').some((part) => part === '..' || part === '')
  ) {
    fail('THEME_PATH_UNSAFE', `${field} must be a local file below the theme directory.`);
  }
  return path;
}

function validateColor(value, field) {
  if (typeof value !== 'string' || !HEX_COLOR_PATTERN.test(value)) {
    fail('THEME_COLOR_INVALID', `${field} must be a six- or eight-digit hex color.`);
  }
  return value.toUpperCase();
}

function withAlpha(value, alpha) {
  return `${value.slice(0, 7)}${alpha}`;
}

function normalizePalette(palette, schemaVersion) {
  if (schemaVersion === 2) {
    return Object.fromEntries(
      SEMANTIC_COLOR_ROLES.map((role) => [role, validateColor(palette[role], `palette.${role}`)]),
    );
  }

  const background = validateColor(palette.background, 'palette.background');
  const surface = validateColor(palette.surface, 'palette.surface');
  const text = validateColor(palette.text, 'palette.text');
  const accent = validateColor(palette.accent, 'palette.accent');
  return {
    background,
    scrim: withAlpha(background, 'D9'),
    surface,
    surfaceElevated: withAlpha(surface, 'F2'),
    surfaceOverlay: withAlpha(background, 'F2'),
    input: surface,
    text,
    textSecondary: withAlpha(text, 'BF'),
    textMuted: withAlpha(text, '8F'),
    textDisabled: withAlpha(text, '66'),
    icon: text,
    iconSecondary: withAlpha(text, 'BF'),
    iconMuted: withAlpha(text, '8F'),
    border: withAlpha(accent, '38'),
    borderSubtle: withAlpha(accent, '1F'),
    borderStrong: withAlpha(accent, '70'),
    accent,
    accentHover: accent,
    selection: withAlpha(accent, '4D'),
    focus: accent,
    link: accent,
    hover: withAlpha(accent, '1F'),
    active: withAlpha(accent, '38'),
    code: withAlpha(background, 'F2'),
    terminal: withAlpha(background, 'F2'),
    diffAdded: '#2DAA6A42',
    diffRemoved: '#FF5F5242',
    success: '#40C977',
    warning: '#F6C85F',
    danger: '#FF6764',
    scrollbar: withAlpha(accent, '45'),
    scrollbarHover: withAlpha(accent, '78'),
    composer: surface,
  };
}

function normalizeExperience(value, schemaVersion) {
  if (value === undefined) return undefined;
  if (schemaVersion !== 2) {
    fail('THEME_EXPERIENCE_UNSUPPORTED', 'experience metadata requires schemaVersion 2.');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('THEME_FIELD_REQUIRED', 'experience must be an object.');
  }
  if (value.chrome !== undefined && typeof value.chrome !== 'boolean') {
    fail('THEME_FIELD_INVALID', 'experience.chrome must be a boolean.');
  }
  return {
    ...Object.fromEntries(
      Object.entries(EXPERIENCE_FIELD_LIMITS).map(([field, maxLength]) => [
        field,
        requireBoundedString(value[field], `experience.${field}`, maxLength),
      ]),
    ),
    chrome: value.chrome ?? true,
  };
}

function validateManifestObject(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    fail('THEME_JSON_INVALID', 'theme.json must contain an object.');
  }

  if (!SUPPORTED_THEME_SCHEMA_VERSIONS.includes(input.schemaVersion)) {
    fail(
      'THEME_SCHEMA_UNSUPPORTED',
      `schemaVersion must be one of ${SUPPORTED_THEME_SCHEMA_VERSIONS.join(', ')}.`,
    );
  }

  const slug = requireString(input.slug, 'slug');
  if (!SLUG_PATTERN.test(slug)) {
    fail('THEME_SLUG_INVALID', 'slug must use lowercase kebab-case.');
  }

  const version = requireString(input.version, 'version');
  if (!VERSION_PATTERN.test(version)) {
    fail('THEME_VERSION_INVALID', 'version must use semantic versioning.');
  }

  const author = input.author;
  if (!author || typeof author !== 'object' || Array.isArray(author)) {
    fail('THEME_FIELD_REQUIRED', 'author must be an object.');
  }

  const license = input.license;
  if (!license || typeof license !== 'object' || Array.isArray(license)) {
    fail('THEME_FIELD_REQUIRED', 'license must be an object.');
  }

  const compatibility = input.compatibility;
  if (!compatibility || typeof compatibility !== 'object' || Array.isArray(compatibility)) {
    fail('THEME_FIELD_REQUIRED', 'compatibility must be an object.');
  }
  const platforms = requireStringArray(compatibility.platforms, 'compatibility.platforms');
  if (platforms.some((platform) => !SUPPORTED_PLATFORMS.has(platform))) {
    fail('THEME_PLATFORM_UNSUPPORTED', 'Only macOS themes are supported in v0.1.');
  }
  if (!SUPPORTED_STATUS.has(compatibility.status)) {
    fail('THEME_COMPATIBILITY_INVALID', 'compatibility.status must be experimental or verified.');
  }

  const palette = input.palette;
  if (!palette || typeof palette !== 'object' || Array.isArray(palette)) {
    fail('THEME_FIELD_REQUIRED', 'palette must be an object.');
  }

  const files = input.files;
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    fail('THEME_FIELD_REQUIRED', 'files must be an object.');
  }

  const mode = input.mode ?? 'dark';
  if (!SUPPORTED_MODES.has(mode)) {
    fail('THEME_MODE_INVALID', 'mode must be dark, light, or system.');
  }

  const appVersions = requireStringArray(compatibility.appVersions, 'compatibility.appVersions');
  if (appVersions.some((range) => !APP_VERSION_RANGE_PATTERN.test(range))) {
    fail('THEME_COMPATIBILITY_INVALID', 'compatibility.appVersions must contain exact versions or a trailing wildcard.');
  }

  const experience = normalizeExperience(input.experience, input.schemaVersion);
  return {
    schemaVersion: input.schemaVersion,
    slug,
    version,
    name: requireString(input.name, 'name'),
    description: requireString(input.description, 'description'),
    author: {
      name: requireString(author.name, 'author.name'),
      ...(author.url ? { url: requireString(author.url, 'author.url') } : {}),
    },
    license: {
      code: requireString(license.code, 'license.code'),
      artwork: requireString(license.artwork, 'license.artwork'),
    },
    categories: requireStringArray(input.categories, 'categories'),
    tags: requireStringArray(input.tags, 'tags'),
    compatibility: {
      platforms,
      status: compatibility.status,
      appVersions,
    },
    mode,
    palette: normalizePalette(palette, input.schemaVersion),
    ...(experience ? { experience } : {}),
    files: {
      css: validateLocalPath(files.css, 'files.css'),
      artwork: validateLocalPath(files.artwork, 'files.artwork'),
      preview: validateLocalPath(files.preview, 'files.preview'),
    },
  };
}

export function validateThemeManifest(input) {
  return validateManifestObject(input);
}

function versionMatchesRange(appVersion, range) {
  const versionParts = appVersion.split('.');
  const rangeParts = range.split('.');
  const wildcard = rangeParts.at(-1) === '*';
  const comparable = wildcard ? rangeParts.slice(0, -1) : rangeParts;
  if (!wildcard && comparable.length !== versionParts.length) return false;
  if (wildcard && versionParts.length < comparable.length) return false;
  return comparable.every((part, index) => versionParts[index] === part);
}

export function assertThemeCompatibility(input, { platform, appVersion } = {}) {
  const manifest = validateThemeManifest(input);
  if (typeof platform !== 'string' || !manifest.compatibility.platforms.includes(platform)) {
    fail('THEME_PLATFORM_UNSUPPORTED', `Theme ${manifest.slug} does not support this platform.`);
  }
  if (typeof appVersion !== 'string' || !/^\d+(?:\.\d+)+$/.test(appVersion)) {
    fail('THEME_APP_VERSION_INVALID', 'A numeric Codex app version is required.');
  }
  if (!manifest.compatibility.appVersions.some((range) => versionMatchesRange(appVersion, range))) {
    fail(
      'THEME_APP_VERSION_UNSUPPORTED',
      `Theme ${manifest.slug} does not declare support for Codex ${appVersion}; official UI was left unchanged.`,
    );
  }
  return { platform, appVersion, status: manifest.compatibility.status };
}

async function resolveThemeFile(root, relativePath) {
  const safeRelativePath = validateLocalPath(relativePath, 'theme file');
  const canonicalRoot = await realpath(root);
  const candidate = resolve(canonicalRoot, safeRelativePath);

  if (!candidate.startsWith(`${canonicalRoot}${sep}`)) {
    fail('THEME_PATH_UNSAFE', 'Theme files must remain below the theme directory.');
  }

  let canonicalFile;
  try {
    canonicalFile = await realpath(candidate);
  } catch (error) {
    fail('THEME_FILE_MISSING', `Theme file is missing: ${safeRelativePath}`, { cause: error });
  }

  if (!canonicalFile.startsWith(`${canonicalRoot}${sep}`)) {
    fail('THEME_PATH_UNSAFE', 'Theme file symlinks must remain below the theme directory.');
  }
  return canonicalFile;
}

function mimeForArtwork(path) {
  const extension = extname(path).toLowerCase();
  const mime = {
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
  }[extension];
  if (!mime) {
    fail('THEME_ASSET_UNSUPPORTED', `Unsupported artwork format: ${extension || '(none)'}`);
  }
  return mime;
}

function validateCss(css) {
  if (css.includes('\\')) {
    fail('THEME_CSS_UNSAFE_ESCAPE', 'Theme CSS cannot contain escape sequences that obscure executable or remote tokens.');
  }
  if (/\@import\s/i.test(css) || /https?:|\/\//i.test(css)) {
    fail('THEME_CSS_REMOTE_IMPORT', 'Theme CSS cannot load remote resources.');
  }
  if (/url\s*\(/i.test(css) || /javascript\s*:|expression\s*\(/i.test(css)) {
    fail('THEME_CSS_UNSAFE_URL', 'Theme CSS contains an unsafe executable URL.');
  }
}

function validateSvg(buffer, path) {
  if (extname(path).toLowerCase() !== '.svg') return;
  const svg = buffer.toString('utf8');
  if (!/<svg(?:\s|>)/i.test(svg)) fail('THEME_SVG_INVALID', 'SVG assets must contain an svg root element.');
  const activeMarkup = /<(?:script|foreignObject|iframe|object|embed|link|style|animate|set)(?:\s|>)/i;
  const eventHandler = /\son[a-z][\w:-]*\s*=/i;
  const obscuredToken = /<!DOCTYPE|<!ENTITY|javascript\s*:|\@import\s|\\|&#/i;
  const withoutNamespaces = svg.replace(/\sxmlns(?::[\w-]+)?\s*=\s*(["']).*?\1/gi, '');
  const remoteToken = /https?:|\/\/|data\s*:\s*text/i;
  if (activeMarkup.test(svg) || eventHandler.test(svg) || obscuredToken.test(svg) || remoteToken.test(withoutNamespaces)) {
    fail('THEME_SVG_UNSAFE', 'SVG assets cannot contain active markup, event handlers, remote CSS, or obscured tokens.');
  }
  for (const match of svg.matchAll(/(?:href|src)\s*=\s*(["'])(.*?)\1/gi)) {
    if (!match[2].startsWith('#')) {
      fail('THEME_SVG_UNSAFE', 'SVG href and src attributes must be local fragment references.');
    }
  }
  for (const match of svg.matchAll(/url\s*\(\s*(["']?)(.*?)\1\s*\)/gi)) {
    if (!match[2].startsWith('#')) {
      fail('THEME_SVG_UNSAFE', 'SVG url functions must be local fragment references.');
    }
  }
}

export async function loadThemePackage(
  root,
  {
    maxAssetBytes = DEFAULT_MAX_ASSET_BYTES,
    maxRuntimeArtworkBytes = DEFAULT_MAX_RUNTIME_ARTWORK_BYTES,
    maxCssBytes = DEFAULT_MAX_CSS_BYTES,
  } = {},
) {
  let canonicalRoot;
  try {
    canonicalRoot = await realpath(root);
  } catch (error) {
    fail('THEME_NOT_FOUND', 'The requested theme directory does not exist or cannot be read.', { cause: error });
  }
  const manifestPath = resolve(canonicalRoot, 'theme.json');
  let manifestInput;
  try {
    manifestInput = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    fail('THEME_JSON_INVALID', 'theme.json is missing or malformed.', { cause: error });
  }
  const manifest = validateThemeManifest(manifestInput);

  const cssPath = await resolveThemeFile(canonicalRoot, manifest.files.css);
  const artworkPath = await resolveThemeFile(canonicalRoot, manifest.files.artwork);
  const previewPath = await resolveThemeFile(canonicalRoot, manifest.files.preview);
  const [cssInfo, artworkInfo, previewInfo] = await Promise.all([
    stat(cssPath),
    stat(artworkPath),
    stat(previewPath),
  ]);

  if (cssInfo.size > maxCssBytes) {
    fail('THEME_CSS_TOO_LARGE', `Theme CSS exceeds ${maxCssBytes} bytes.`);
  }
  if (artworkInfo.size > maxAssetBytes || previewInfo.size > maxAssetBytes) {
    fail('THEME_ASSET_TOO_LARGE', `Theme artwork exceeds ${maxAssetBytes} bytes.`);
  }
  if (artworkInfo.size > maxRuntimeArtworkBytes) {
    fail(
      'THEME_RUNTIME_ARTWORK_TOO_LARGE',
      `Runtime artwork exceeds ${maxRuntimeArtworkBytes} bytes and cannot be injected reliably.`,
    );
  }

  const [css, artworkBuffer, previewBuffer] = await Promise.all([
    readFile(cssPath, 'utf8'),
    readFile(artworkPath),
    readFile(previewPath),
  ]);
  validateCss(css);
  const mime = mimeForArtwork(artworkPath);
  mimeForArtwork(previewPath);
  validateSvg(artworkBuffer, artworkPath);
  validateSvg(previewBuffer, previewPath);

  return {
    root: canonicalRoot,
    manifest,
    css,
    artwork: {
      path: artworkPath,
      mime,
      bytes: artworkBuffer.byteLength,
      dataUrl: `data:${mime};base64,${artworkBuffer.toString('base64')}`,
    },
    previewPath,
  };
}
