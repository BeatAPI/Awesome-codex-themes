import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  LAUNCH_AGENT_LABEL,
  bootoutLaunchAgent,
  bootstrapLaunchAgent,
  buildLaunchAgentPlist,
  kickstartLaunchAgent,
  writeLaunchAgentPlist,
} from '../../src/engine/launch-agent.mjs';

const tempDirs = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('LaunchAgent definition', () => {
  test('generates a stable escaped user agent with login persistence', () => {
    const plist = buildLaunchAgentPlist({
      launcherPath: '/Users/test/Awesome & Themes/current/bin/awesome-codex-themes',
      stdoutPath: '/Users/test/Library/Logs/AwesomeCodexThemes.log',
      stderrPath: '/Users/test/Library/Logs/AwesomeCodexThemes.error.log',
    });

    expect(LAUNCH_AGENT_LABEL).toBe('io.github.awesome-codex-themes.agent');
    expect(plist).toContain('<string>io.github.awesome-codex-themes.agent</string>');
    expect(plist).toContain('/Users/test/Awesome &amp; Themes/current/bin/awesome-codex-themes');
    expect(plist).toContain('<string>_agent</string>');
    expect(plist).toContain('<key>RunAtLoad</key>\n    <true/>');
    expect(plist).toContain('<key>KeepAlive</key>\n    <true/>');
    expect(plist).not.toContain('--remote-allow-origins');
  });

  test('rejects relative installed paths', () => {
    expect(() => buildLaunchAgentPlist({
      launcherPath: 'bin/awesome-codex-themes',
      stdoutPath: '/tmp/out.log',
      stderrPath: '/tmp/error.log',
    })).toThrowError(expect.objectContaining({ code: 'LAUNCH_AGENT_PATH_INVALID' }));
  });

  test('writes a readable plist atomically', async () => {
    const root = await mkdtemp(join(tmpdir(), 'awesome-codex-plist-'));
    tempDirs.push(root);
    const path = join(root, 'LaunchAgents/agent.plist');
    const plist = buildLaunchAgentPlist({
      launcherPath: '/opt/awesome/bin/awesome-codex-themes',
      stdoutPath: '/tmp/out.log',
      stderrPath: '/tmp/error.log',
    });

    await writeLaunchAgentPlist(path, plist);

    expect(await readFile(path, 'utf8')).toBe(plist);
    expect((await stat(path)).mode & 0o777).toBe(0o644);
  });
});

describe('launchctl operations', () => {
  test('reports whether the user service is actually loaded', async () => {
    const launchAgent = await import('../../src/engine/launch-agent.mjs');
    expect(launchAgent.isLaunchAgentLoaded).toBeTypeOf('function');
    if (typeof launchAgent.isLaunchAgentLoaded !== 'function') return;

    const run = vi.fn(async () => ({ stdout: '', stderr: '' }));
    await expect(launchAgent.isLaunchAgentLoaded({ uid: 501, run })).resolves.toBe(true);
    expect(run).toHaveBeenCalledWith('/bin/launchctl', [
      'print',
      'gui/501/io.github.awesome-codex-themes.agent',
    ]);

    const missing = Object.assign(new Error('Could not find service'), {
      code: 113,
      stderr: 'Could not find service "io.github.awesome-codex-themes.agent" in domain for user gui: 501',
    });
    run.mockRejectedValueOnce(missing);
    await expect(launchAgent.isLaunchAgentLoaded({ uid: 501, run })).resolves.toBe(false);

    const denied = Object.assign(new Error('Operation not permitted'), { code: 1, stderr: 'Operation not permitted' });
    run.mockRejectedValueOnce(denied);
    await expect(launchAgent.isLaunchAgentLoaded({ uid: 501, run })).rejects.toEqual(
      expect.objectContaining({ code: 'LAUNCH_AGENT_STATUS_FAILED', cause: denied }),
    );
  });

  test('uses argument arrays for bootstrap, kickstart, and bootout', async () => {
    const run = vi.fn(async () => ({ stdout: '', stderr: '' }));

    await bootstrapLaunchAgent('/Users/test/Library/LaunchAgents/agent.plist', { uid: 501, run });
    await kickstartLaunchAgent({ uid: 501, run });
    await bootoutLaunchAgent({ uid: 501, run });

    expect(run.mock.calls).toEqual([
      ['/bin/launchctl', ['bootstrap', 'gui/501', '/Users/test/Library/LaunchAgents/agent.plist']],
      ['/bin/launchctl', ['kickstart', '-k', 'gui/501/io.github.awesome-codex-themes.agent']],
      ['/bin/launchctl', ['bootout', 'gui/501/io.github.awesome-codex-themes.agent']],
    ]);
  });

  test('ignores only a missing service when bootout is used for replacement', async () => {
    const missing = Object.assign(new Error('Boot-out failed: 3: No such process'), {
      code: 3,
      stderr: 'Boot-out failed: 3: No such process',
    });
    const run = vi.fn().mockRejectedValueOnce(missing);

    await expect(bootoutLaunchAgent({ uid: 501, run, ignoreMissing: true })).resolves.toBeUndefined();

    const denied = Object.assign(new Error('Operation not permitted'), { code: 1, stderr: 'Operation not permitted' });
    run.mockRejectedValueOnce(denied);
    await expect(bootoutLaunchAgent({ uid: 501, run, ignoreMissing: true })).rejects.toEqual(
      expect.objectContaining({ code: 'LAUNCH_AGENT_BOOTOUT_FAILED', cause: denied }),
    );
  });

  test('retries the transient launchd unload window before bootstrap succeeds', async () => {
    const transient = Object.assign(new Error('Bootstrap failed: 5: Input/output error'), {
      code: 5,
      stderr: 'Bootstrap failed: 5: Input/output error',
    });
    const run = vi.fn()
      .mockRejectedValueOnce(transient)
      .mockRejectedValueOnce(transient)
      .mockResolvedValueOnce({ stdout: '', stderr: '' });
    const delay = vi.fn(async () => {});

    await expect(
      bootstrapLaunchAgent('/Users/test/Library/LaunchAgents/agent.plist', {
        uid: 501,
        run,
        delay,
        attempts: 3,
      }),
    ).resolves.toBeUndefined();

    expect(run).toHaveBeenCalledTimes(3);
    expect(delay).toHaveBeenCalledTimes(2);
  });

  test('wraps launchctl failures in stable public error codes', async () => {
    const failure = new Error('launchctl failed');
    const run = vi.fn(async () => { throw failure; });

    await expect(
      bootstrapLaunchAgent('/Users/test/Library/LaunchAgents/agent.plist', { uid: 501, run }),
    ).rejects.toEqual(expect.objectContaining({ code: 'LAUNCH_AGENT_BOOTSTRAP_FAILED', cause: failure }));
    await expect(kickstartLaunchAgent({ uid: 501, run })).rejects.toEqual(
      expect.objectContaining({ code: 'LAUNCH_AGENT_KICKSTART_FAILED', cause: failure }),
    );
  });
});
