import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class AgentConfigError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'AgentConfigError';
    this.code = code;
  }
}

function fail(code, message, options) {
  throw new AgentConfigError(code, message, options);
}

export function validateAgentConfig(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.schemaVersion !== 1) {
    fail('CONFIG_SCHEMA_INVALID', 'Agent configuration schemaVersion must be 1.');
  }
  if (typeof input.enabled !== 'boolean' || typeof input.launchAtLogin !== 'boolean') {
    fail('CONFIG_FIELD_INVALID', 'enabled and launchAtLogin must be booleans.');
  }
  if (typeof input.themeSlug !== 'string' || !SLUG_PATTERN.test(input.themeSlug)) {
    fail('CONFIG_THEME_INVALID', 'themeSlug must use lowercase kebab-case.');
  }
  return {
    schemaVersion: 1,
    enabled: input.enabled,
    themeSlug: input.themeSlug,
    launchAtLogin: input.launchAtLogin,
  };
}

export async function writeAgentConfig(path, input) {
  const config = validateAgentConfig(input);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
    await chmod(temporaryPath, 0o600);
    await rename(temporaryPath, path);
    await chmod(path, 0o600);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {});
    fail('CONFIG_WRITE_FAILED', 'Unable to write agent configuration atomically.', { cause: error });
  }
}

export async function readAgentConfig(path) {
  try {
    return validateAgentConfig(JSON.parse(await readFile(path, 'utf8')));
  } catch (error) {
    if (error instanceof AgentConfigError) throw error;
    fail('CONFIG_READ_FAILED', 'Agent configuration is missing or malformed.', { cause: error });
  }
}
