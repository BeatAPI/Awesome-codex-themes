import { access } from 'node:fs/promises';
import { arch as hostArchitecture } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const EXPECTED_BUNDLE_ID = 'com.openai.codex';
export const EXPECTED_TEAM_ID = '2DC432GLL2';
export const DEFAULT_APP_CANDIDATES = [
  '/Applications/ChatGPT.app',
  '/Applications/Codex.app',
  join(process.env.HOME ?? '', 'Applications/ChatGPT.app'),
  join(process.env.HOME ?? '', 'Applications/Codex.app'),
].filter((path) => isAbsolute(path));

const execFileAsync = promisify(execFile);

export class MacRuntimeError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'MacRuntimeError';
    this.code = code;
  }
}

function macFail(code, message, options) {
  throw new MacRuntimeError(code, message, options);
}

function requiredString(value, code, message) {
  if (typeof value !== 'string' || !value.trim()) macFail(code, message);
  return value.trim();
}

export function validateMacAppInspection(input) {
  if (!input || typeof input !== 'object') macFail('APP_INSPECTION_INVALID', 'Application inspection is missing.');
  if (input.bundleId !== EXPECTED_BUNDLE_ID) {
    macFail('APP_IDENTITY_INVALID', `Expected bundle identifier ${EXPECTED_BUNDLE_ID}.`);
  }
  if (!input.signatureValid || input.teamId !== EXPECTED_TEAM_ID) {
    macFail('APP_SIGNATURE_INVALID', `Expected an intact OpenAI signature from Team ID ${EXPECTED_TEAM_ID}.`);
  }

  const nodeVersion = requiredString(input.nodeVersion, 'APP_RUNTIME_UNSUPPORTED', 'Bundled Node version is missing.');
  const major = Number(nodeVersion.split('.')[0]);
  if (!Number.isInteger(major) || major < 20) {
    macFail('APP_RUNTIME_UNSUPPORTED', 'The bundled Node runtime must be version 20 or newer.');
  }
  if (input.nodeArch !== input.hostArch) {
    macFail('APP_ARCH_MISMATCH', 'The official app runtime architecture does not match this Mac.');
  }
  if (!isAbsolute(input.appPath) || !isAbsolute(input.executable) || !isAbsolute(input.nodePath)) {
    macFail('APP_PATH_INVALID', 'Official application paths must be absolute.');
  }

  return {
    appPath: input.appPath,
    executable: input.executable,
    nodePath: input.nodePath,
    bundleId: input.bundleId,
    version: requiredString(input.version, 'APP_VERSION_INVALID', 'Application version is missing.'),
    teamId: input.teamId,
    signatureValid: true,
    nodeVersion,
    nodeArch: input.nodeArch,
    hostArch: input.hostArch,
  };
}

async function defaultRunCommand(command, args) {
  return execFileAsync(command, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 });
}

async function readPlistField(infoPlist, field, runCommand) {
  const result = await runCommand('/usr/libexec/PlistBuddy', ['-c', `Print :${field}`, infoPlist]);
  return result.stdout.trim();
}

export async function inspectOfficialApp(
  appPath,
  { accessImpl = access, runCommand = defaultRunCommand, hostArch = hostArchitecture() } = {},
) {
  if (!isAbsolute(appPath) || !appPath.endsWith('.app')) macFail('APP_PATH_INVALID', 'Application path must be an absolute .app bundle.');
  const infoPlist = join(appPath, 'Contents/Info.plist');
  const nodePath = join(appPath, 'Contents/Resources/cua_node/bin/node');

  try {
    await Promise.all([accessImpl(appPath), accessImpl(infoPlist), accessImpl(nodePath)]);
  } catch (error) {
    macFail('APP_NOT_FOUND', `Official Codex application files were not found at ${appPath}.`, { cause: error });
  }

  let signatureValid = false;
  try {
    await runCommand('/usr/bin/codesign', ['--verify', '--deep', '--strict', appPath]);
    signatureValid = true;
  } catch (error) {
    macFail('APP_SIGNATURE_INVALID', 'The official application code signature did not validate.', { cause: error });
  }

  try {
    const [bundleId, version, executableName, signatureDetails, nodeVersion, nodeArch] = await Promise.all([
      readPlistField(infoPlist, 'CFBundleIdentifier', runCommand),
      readPlistField(infoPlist, 'CFBundleShortVersionString', runCommand),
      readPlistField(infoPlist, 'CFBundleExecutable', runCommand),
      runCommand('/usr/bin/codesign', ['-dv', '--verbose=4', appPath]),
      runCommand(nodePath, ['--version']),
      runCommand(nodePath, ['-p', 'process.arch']),
    ]);
    const detailText = `${signatureDetails.stdout ?? ''}\n${signatureDetails.stderr ?? ''}`;
    const teamId = detailText.match(/^TeamIdentifier=(.+)$/m)?.[1]?.trim() ?? '';

    return validateMacAppInspection({
      appPath,
      executable: join(appPath, 'Contents/MacOS', executableName),
      nodePath,
      bundleId,
      version,
      teamId,
      signatureValid,
      nodeVersion: nodeVersion.stdout.trim().replace(/^v/, ''),
      nodeArch: nodeArch.stdout.trim(),
      hostArch,
    });
  } catch (error) {
    if (error instanceof MacRuntimeError) throw error;
    macFail('APP_INSPECTION_FAILED', 'Unable to inspect the official application safely.', { cause: error });
  }
}

export async function discoverOfficialApp({
  candidates = DEFAULT_APP_CANDIDATES,
  inspect = inspectOfficialApp,
} = {}) {
  const failures = [];
  for (const candidate of candidates) {
    try {
      return await inspect(candidate);
    } catch (error) {
      failures.push(error);
    }
  }
  macFail('APP_NOT_FOUND', 'No signed, supported official Codex Desktop application was found.', {
    cause: new AggregateError(failures, 'Application discovery failed.'),
  });
}

export async function listOfficialAppPids(inspection, { runCommand = defaultRunCommand } = {}) {
  const trusted = validateMacAppInspection(inspection);
  const result = await runCommand('/bin/ps', ['-axo', 'pid=,command=']);
  return result.stdout
    .split('\n')
    .map((line) => line.trim().match(/^(\d+)\s+(.+)$/))
    .filter(Boolean)
    .filter((match) => match[2] === trusted.executable || match[2].startsWith(`${trusted.executable} `))
    .map((match) => Number(match[1]));
}

export async function processStartedAt(pid, { runCommand = defaultRunCommand } = {}) {
  if (!Number.isInteger(pid) || pid < 1) macFail('PROCESS_ID_INVALID', 'PID must be a positive integer.');
  const result = await runCommand('/bin/ps', ['-p', String(pid), '-o', 'lstart=']);
  return requiredString(result.stdout, 'PROCESS_NOT_FOUND', `Process ${pid} is not running.`);
}

export async function assertOfficialPortOwner(
  inspection,
  port,
  { runCommand = defaultRunCommand, listPids = listOfficialAppPids } = {},
) {
  const trusted = validateMacAppInspection(inspection);
  if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
    macFail('CDP_PORT_INVALID', 'A valid non-privileged CDP port is required.');
  }

  const officialPids = new Set(await listPids(trusted));
  let result;
  try {
    result = await runCommand('/usr/sbin/lsof', [
      '-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-F', 'pn',
    ]);
  } catch (error) {
    macFail('CDP_PORT_UNAVAILABLE', `No verified listener was found on 127.0.0.1:${port}.`, { cause: error });
  }

  const listeners = [];
  let currentPid = null;
  for (const line of result.stdout.split('\n')) {
    if (/^p\d+$/.test(line)) currentPid = Number(line.slice(1));
    if (line.startsWith('n') && currentPid) listeners.push({ pid: currentPid, endpoint: line.slice(1) });
  }
  if (listeners.length === 0) {
    macFail('CDP_PORT_UNAVAILABLE', `No verified listener was found on 127.0.0.1:${port}.`);
  }
  if (listeners.some((listener) => listener.endpoint !== `127.0.0.1:${port}`)) {
    macFail('CDP_LISTENER_UNSAFE', 'The CDP listener must bind only to the literal 127.0.0.1 address.');
  }
  if (listeners.some((listener) => !officialPids.has(listener.pid))) {
    macFail('CDP_PORT_OWNER_INVALID', 'The CDP listener is not owned by the inspected official Codex process.');
  }

  return { port, ownerPids: [...new Set(listeners.map((listener) => listener.pid))] };
}
