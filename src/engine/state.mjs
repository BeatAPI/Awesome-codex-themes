import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute } from 'node:path';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class RuntimeStateError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'RuntimeStateError';
    this.code = code;
  }
}

function stateFail(code, message, options) {
  throw new RuntimeStateError(code, message, options);
}

function requireString(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    stateFail('STATE_FIELD_INVALID', `${field} must be a non-empty string.`);
  }
  return value;
}

function requirePid(value, field) {
  if (!Number.isInteger(value) || value < 1) stateFail('STATE_PID_INVALID', `${field} must be a positive PID.`);
  return value;
}

export function validateRuntimeState(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.schemaVersion !== 1) {
    stateFail('STATE_SCHEMA_INVALID', 'Runtime state schemaVersion must be 1.');
  }
  if (!isAbsolute(input.appPath)) stateFail('STATE_PATH_INVALID', 'appPath must be absolute.');
  if (!Number.isInteger(input.port) || input.port < 1024 || input.port > 65_535) {
    stateFail('STATE_PORT_INVALID', 'port must be a non-privileged TCP port.');
  }
  if (typeof input.themeSlug !== 'string' || !SLUG_PATTERN.test(input.themeSlug)) {
    stateFail('STATE_THEME_INVALID', 'themeSlug must use lowercase kebab-case.');
  }

  return {
    schemaVersion: 1,
    appPath: input.appPath,
    appVersion: requireString(input.appVersion, 'appVersion'),
    appPid: requirePid(input.appPid, 'appPid'),
    appStartedAt: requireString(input.appStartedAt, 'appStartedAt'),
    port: input.port,
    themeSlug: input.themeSlug,
    injectorPid: requirePid(input.injectorPid, 'injectorPid'),
    injectorStartedAt: requireString(input.injectorStartedAt, 'injectorStartedAt'),
    injectorExecutable: requireString(input.injectorExecutable, 'injectorExecutable'),
    injectorScript: requireString(input.injectorScript, 'injectorScript'),
  };
}

export function matchesProcessIdentity(state, observed) {
  return Boolean(
    observed &&
      state.injectorPid === observed.pid &&
      state.injectorStartedAt === observed.startedAt &&
      state.injectorExecutable === observed.executable &&
      state.injectorScript === observed.script,
  );
}

export async function writeRuntimeState(path, input) {
  const state = validateRuntimeState(input);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    await chmod(temporaryPath, 0o600);
    await rename(temporaryPath, path);
    await chmod(path, 0o600);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {});
    stateFail('STATE_WRITE_FAILED', 'Unable to write runtime state atomically.', { cause: error });
  }
}

export async function readRuntimeState(path) {
  try {
    return validateRuntimeState(JSON.parse(await readFile(path, 'utf8')));
  } catch (error) {
    if (error instanceof RuntimeStateError) throw error;
    stateFail('STATE_READ_FAILED', 'Runtime state is missing or malformed.', { cause: error });
  }
}
