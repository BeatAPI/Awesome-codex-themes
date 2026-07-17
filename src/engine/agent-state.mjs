import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STATUSES = new Set([
  'idle',
  'starting',
  'active',
  'restart-required',
  'paused',
  'error',
]);

export class AgentStateError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'AgentStateError';
    this.code = code;
  }
}

function fail(code, message, options) {
  throw new AgentStateError(code, message, options);
}

function nullableString(value, field) {
  if (value === null) return null;
  if (typeof value !== 'string' || !value.trim()) fail('AGENT_STATE_FIELD_INVALID', `${field} must be null or a non-empty string.`);
  return value;
}

export function validateAgentState(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.schemaVersion !== 1) {
    fail('AGENT_STATE_SCHEMA_INVALID', 'Agent state schemaVersion must be 1.');
  }
  if (!STATUSES.has(input.status)) fail('AGENT_STATE_STATUS_INVALID', 'Agent state status is unsupported.');
  if (typeof input.themeSlug !== 'string' || !SLUG_PATTERN.test(input.themeSlug)) {
    fail('AGENT_STATE_THEME_INVALID', 'themeSlug must use lowercase kebab-case.');
  }
  if (input.appPid !== null && (!Number.isInteger(input.appPid) || input.appPid < 1)) {
    fail('AGENT_STATE_PID_INVALID', 'appPid must be null or a positive PID.');
  }
  if (input.port !== null && (!Number.isInteger(input.port) || input.port < 1024 || input.port > 65_535)) {
    fail('AGENT_STATE_PORT_INVALID', 'port must be null or a non-privileged TCP port.');
  }
  return {
    schemaVersion: 1,
    status: input.status,
    themeSlug: input.themeSlug,
    appPid: input.appPid,
    appVersion: nullableString(input.appVersion, 'appVersion'),
    port: input.port,
    errorCode: nullableString(input.errorCode, 'errorCode'),
    updatedAt: nullableString(input.updatedAt, 'updatedAt'),
  };
}

export async function isActiveAgentStateLive(
  input,
  { discoverApp, listPids, assertPortOwner, isAgentLoaded },
) {
  const state = validateAgentState(input);
  if (state.status !== 'active' || state.appPid === null || state.port === null) return false;
  try {
    if (!(await isAgentLoaded())) return false;
    const app = await discoverApp();
    if (app.version !== state.appVersion) return false;
    const pids = await listPids(app);
    if (!pids.includes(state.appPid)) return false;
    await assertPortOwner(app, state.port);
    return true;
  } catch {
    return false;
  }
}

export async function writeAgentState(path, input) {
  const state = validateAgentState(input);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    await chmod(temporaryPath, 0o600);
    await rename(temporaryPath, path);
    await chmod(path, 0o600);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {});
    fail('AGENT_STATE_WRITE_FAILED', 'Unable to write agent state atomically.', { cause: error });
  }
}

export async function readAgentState(path) {
  try {
    return validateAgentState(JSON.parse(await readFile(path, 'utf8')));
  } catch (error) {
    if (error instanceof AgentStateError) throw error;
    fail('AGENT_STATE_READ_FAILED', 'Agent state is missing or malformed.', { cause: error });
  }
}
