import { execFile } from 'node:child_process';
import { chmod, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute } from 'node:path';
import { promisify } from 'node:util';

export const LAUNCH_AGENT_LABEL = 'io.github.awesome-codex-themes.agent';

const execFileAsync = promisify(execFile);

export class LaunchAgentError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'LaunchAgentError';
    this.code = code;
  }
}

function fail(code, message, options) {
  throw new LaunchAgentError(code, message, options);
}

function requireAbsolutePath(value, field) {
  if (typeof value !== 'string' || !isAbsolute(value)) {
    fail('LAUNCH_AGENT_PATH_INVALID', `${field} must be an absolute path.`);
  }
  return value;
}

function xml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function buildLaunchAgentPlist({ launcherPath, stdoutPath, stderrPath }) {
  const launcher = xml(requireAbsolutePath(launcherPath, 'launcherPath'));
  const stdout = xml(requireAbsolutePath(stdoutPath, 'stdoutPath'));
  const stderr = xml(requireAbsolutePath(stderrPath, 'stderrPath'));
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LAUNCH_AGENT_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${launcher}</string>
        <string>_agent</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>ProcessType</key>
    <string>Background</string>
    <key>ThrottleInterval</key>
    <integer>10</integer>
    <key>StandardOutPath</key>
    <string>${stdout}</string>
    <key>StandardErrorPath</key>
    <string>${stderr}</string>
</dict>
</plist>
`;
}

export async function writeLaunchAgentPlist(path, plist) {
  requireAbsolutePath(path, 'plist path');
  if (typeof plist !== 'string' || !plist.includes(`<string>${LAUNCH_AGENT_LABEL}</string>`)) {
    fail('LAUNCH_AGENT_PLIST_INVALID', 'LaunchAgent plist content is invalid.');
  }
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(temporaryPath, plist, { mode: 0o644 });
    await chmod(temporaryPath, 0o644);
    await rename(temporaryPath, path);
    await chmod(path, 0o644);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {});
    fail('LAUNCH_AGENT_WRITE_FAILED', 'Unable to write the LaunchAgent plist atomically.', { cause: error });
  }
}

function domain(uid) {
  if (!Number.isInteger(uid) || uid < 1) fail('LAUNCH_AGENT_UID_INVALID', 'A positive user ID is required.');
  return `gui/${uid}`;
}

async function defaultRun(executable, args) {
  return execFileAsync(executable, args, { encoding: 'utf8' });
}

function isTransientBootstrap(error) {
  const detail = `${error?.message ?? ''}\n${error?.stderr ?? ''}`.toLowerCase();
  return error?.code === 5 && detail.includes('input/output error');
}

export async function bootstrapLaunchAgent(
  plistPath,
  {
    uid = process.getuid?.(),
    run = defaultRun,
    delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    attempts = 20,
  } = {},
) {
  const args = ['bootstrap', domain(uid), requireAbsolutePath(plistPath, 'plistPath')];
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await run('/bin/launchctl', args);
      return;
    } catch (error) {
      lastError = error;
      if (!isTransientBootstrap(error) || attempt === attempts) break;
      await delay(250);
    }
  }
  fail('LAUNCH_AGENT_BOOTSTRAP_FAILED', 'Unable to bootstrap the Awesome Codex Themes LaunchAgent.', {
    cause: lastError,
  });
}

export async function kickstartLaunchAgent({ uid = process.getuid?.(), run = defaultRun } = {}) {
  const target = `${domain(uid)}/${LAUNCH_AGENT_LABEL}`;
  try {
    await run('/bin/launchctl', ['kickstart', '-k', target]);
  } catch (error) {
    fail('LAUNCH_AGENT_KICKSTART_FAILED', 'Unable to kickstart the Awesome Codex Themes LaunchAgent.', { cause: error });
  }
}

function isMissingService(error) {
  const detail = `${error?.message ?? ''}\n${error?.stderr ?? ''}`.toLowerCase();
  return (error?.code === 3 || error?.code === 113) && (
    detail.includes('no such process') ||
    detail.includes('could not find specified service') ||
    detail.includes('could not find service')
  );
}

export async function isLaunchAgentLoaded({ uid = process.getuid?.(), run = defaultRun } = {}) {
  const target = `${domain(uid)}/${LAUNCH_AGENT_LABEL}`;
  try {
    await run('/bin/launchctl', ['print', target]);
    return true;
  } catch (error) {
    if (isMissingService(error)) return false;
    fail('LAUNCH_AGENT_STATUS_FAILED', 'Unable to inspect the Awesome Codex Themes LaunchAgent.', { cause: error });
  }
}

export async function bootoutLaunchAgent(
  { uid = process.getuid?.(), run = defaultRun, ignoreMissing = false } = {},
) {
  const target = `${domain(uid)}/${LAUNCH_AGENT_LABEL}`;
  try {
    await run('/bin/launchctl', ['bootout', target]);
  } catch (error) {
    if (ignoreMissing && isMissingService(error)) return;
    fail('LAUNCH_AGENT_BOOTOUT_FAILED', 'Unable to boot out the Awesome Codex Themes LaunchAgent.', { cause: error });
  }
}
