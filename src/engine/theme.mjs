import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, resolve, sep } from 'node:path';

export const THEME_SCHEMA_VERSION = 1;
export const DEFAULT_MAX_ASSET_BYTES = 10 * 1024 * 1024;
export const DEFAULT_MAX_CSS_BYTES = 256 * 1024;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const APP_VERSION_RANGE_PATTERN = /^\d+(?:\.\d+)+(?:\.\*)?$/;
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?$/;
const SUPPORTED_PLATFORMS = new Set(['macos']);
const SUPPORTED_STATUS = new Set(['experimental', 'verified']);
const SUPPORTED_MODES = new Set(['dark', 'light', 'system']);

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

function validateManifestObject(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    fail('THEME_JSON_INVALID', 'theme.json must contain an object.');
  }

  if (input.schemaVersion !== THEME_SCHEMA_VERSION) {
    fail('THEME_SCHEMA_UNSUPPORTED', `schemaVersion must be ${THEME_SCHEMA_VERSION}.`);
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

  return {
    schemaVersion: THEME_SCHEMA_VERSION,
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
    palette: {
      background: validateColor(palette.background, 'palette.background'),
      surface: validateColor(palette.surface, 'palette.surface'),
      text: validateColor(palette.text, 'palette.text'),
      accent: validateColor(palette.accent, 'palette.accent'),
    },
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
  if (/\@import\s/i.test(css) || /url\(\s*["']?(?:https?:|\/\/)/i.test(css)) {
    fail('THEME_CSS_REMOTE_IMPORT', 'Theme CSS cannot load remote resources.');
  }
  if (/url\(\s*["']?javascript:/i.test(css) || /expression\s*\(/i.test(css)) {
    fail('THEME_CSS_UNSAFE_URL', 'Theme CSS contains an unsafe executable URL.');
  }
}

export async function loadThemePackage(
  root,
  { maxAssetBytes = DEFAULT_MAX_ASSET_BYTES, maxCssBytes = DEFAULT_MAX_CSS_BYTES } = {},
) {
  const canonicalRoot = await realpath(root);
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

  const [css, artworkBuffer] = await Promise.all([readFile(cssPath, 'utf8'), readFile(artworkPath)]);
  validateCss(css);
  const mime = mimeForArtwork(artworkPath);

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
