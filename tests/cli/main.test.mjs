import { describe, expect, test, vi } from 'vitest';

import {
  CliError,
  createStartupTakeoverGate,
  launchOfficialApp,
  requestOfficialAppQuit,
  runCli,
  terminateProcess,
  waitForOfficialAppExit,
  waitForRenderer,
} from '../../src/cli/main.mjs';

function createIo() {
  const stdout = [];
  const stderr = [];
  return {
    stdout,
    stderr,
    io: {
      out: (value) => stdout.push(value),
      error: (value) => stderr.push(value),
    },
  };
}

function dependencies(overrides = {}) {
  return {
    listThemes: async () => [],
    doctor: async () => ({ appPath: '/Applications/ChatGPT.app', version: '26.707.72221', runningPids: [], conflicts: [] }),
    start: async () => ({ theme: 'obsidian-bloom', port: 9341 }),
    apply: async () => ({ theme: 'obsidian-bloom', renderers: 1 }),
    status: async () => ({ active: false }),
    restore: async () => ({ restored: true, theme: 'obsidian-bloom' }),
    installAgent: async () => ({ installed: true, theme: 'satoru-gojo', supportRoot: '/support' }),
    upgradeAgent: async () => ({ upgraded: true, theme: 'satoru-gojo', version: '0.3.0', enabled: false }),
    switchTheme: async () => ({ switched: true, theme: 'satoru-gojo' }),
    pause: async () => ({ paused: true, theme: 'satoru-gojo' }),
    resume: async () => ({ resumed: true, theme: 'satoru-gojo' }),
    uninstallAgent: async () => ({ uninstalled: true }),
    runAgent: async () => ({ stopped: true }),
    watch: async () => {},
    ...overrides,
  };
}

describe('runCli', () => {
  test('prints a stable global help surface', async () => {
    const { io, stdout } = createIo();

    await expect(runCli(['help'], dependencies(), io)).resolves.toBe(0);
    expect(stdout.join('\n')).toContain('start <theme>');
    expect(stdout.join('\n')).toContain('install-agent <theme> [--takeover-at-login]');
    expect(stdout.join('\n')).toContain('upgrade-agent');
    expect(stdout.join('\n')).toContain('switch <theme>');
    expect(stdout.join('\n')).toContain('uninstall-agent');
    expect(stdout.join('\n')).toContain('restore');
    expect(stdout.join('\n')).not.toContain('_watch');
    expect(stdout.join('\n')).not.toContain('_agent');
  });

  test('lists themes with category and compatibility metadata', async () => {
    const { io, stdout } = createIo();
    const deps = dependencies({
      listThemes: async () => [
        {
          slug: 'satoru-gojo',
          name: 'Satoru Gojo',
          nativeName: '五条 悟',
          categories: ['light', 'editorial'],
          status: 'experimental',
          strategy: 'best-effort-all',
          verifiedAppVersions: ['26.707.*', '26.715.*'],
        },
      ],
    });

    await expect(runCli(['list'], deps, io)).resolves.toBe(0);
    expect(stdout.join('\n')).toContain('satoru-gojo');
    expect(stdout.join('\n')).toContain('light, editorial');
    expect(stdout.join('\n')).toContain('experimental');
    expect(stdout.join('\n')).toContain('best effort: all numeric versions');
    expect(stdout.join('\n')).toContain('high compatibility: 26.707.*, 26.715.*');
    expect(stdout.join('\n')).toContain('Satoru Gojo / 五条 悟');
  });

  test('reports doctor evidence without changing application state', async () => {
    const { io, stdout } = createIo();
    const doctor = vi.fn(dependencies().doctor);

    await expect(runCli(['doctor'], dependencies({ doctor }), io)).resolves.toBe(0);
    expect(doctor).toHaveBeenCalledOnce();
    expect(stdout.join('\n')).toContain('/Applications/ChatGPT.app');
    expect(stdout.join('\n')).toContain('26.707.72221');
  });

  test('reports injector conflicts as read-only migration warnings', async () => {
    const { io, stdout } = createIo();

    await expect(
      runCli(
        ['doctor'],
        dependencies({
          doctor: async () => ({
            appPath: '/Applications/ChatGPT.app',
            version: '26.707.72221',
            runningPids: [123],
            conflicts: [{ id: 'legacy-nocturne-launch-agent', path: '/Users/test/Library/LaunchAgents/legacy.plist' }],
          }),
        }),
        io,
      ),
    ).resolves.toBe(0);

    expect(stdout.join('\n')).toContain('conflict: legacy-nocturne-launch-agent');
    expect(stdout.join('\n')).toContain('no files were changed');
  });

  test('requires an explicit theme for start and apply', async () => {
    const { io, stderr } = createIo();

    await expect(runCli(['start'], dependencies(), io)).resolves.toBe(1);
    expect(stderr.join('\n')).toContain('[CLI_THEME_REQUIRED]');
  });

  test('passes a validated explicit port to apply', async () => {
    const { io, stdout } = createIo();
    const apply = vi.fn(dependencies().apply);

    await expect(runCli(['apply', 'obsidian-bloom', '--port', '9341'], dependencies({ apply }), io)).resolves.toBe(0);
    expect(apply).toHaveBeenCalledWith('obsidian-bloom', 9341);
    expect(stdout.join('\n')).toContain('1 renderer');
  });

  test('prints stable error codes and preserves the original recovery message', async () => {
    const { io, stderr } = createIo();
    const start = vi.fn(async () => {
      throw new CliError('APP_ALREADY_RUNNING', 'Quit Codex explicitly; no process was terminated.');
    });

    await expect(runCli(['start', 'obsidian-bloom'], dependencies({ start }), io)).resolves.toBe(1);
    expect(stderr).toEqual(['[APP_ALREADY_RUNNING] Quit Codex explicitly; no process was terminated.']);
  });

  test('reports inactive status as a successful diagnostic result', async () => {
    const { io, stdout } = createIo();

    await expect(runCli(['status'], dependencies(), io)).resolves.toBe(0);
    expect(stdout).toEqual(['inactive — official UI is not managed by Awesome Codex Themes']);
  });

  test('does not call a stale state file active', async () => {
    const { io, stdout } = createIo();

    await expect(
      runCli(['status'], dependencies({ status: async () => ({ active: false, stale: true, theme: 'arctic-signal' }) }), io),
    ).resolves.toBe(0);
    expect(stdout.join('\n')).toContain('stale state');
    expect(stdout.join('\n')).toContain('run restore');
  });

  test('installs persistent mode for an explicit validated theme', async () => {
    const { io, stdout } = createIo();
    const installAgent = vi.fn(dependencies().installAgent);

    await expect(runCli(['install-agent', 'satoru-gojo'], dependencies({ installAgent }), io)).resolves.toBe(0);

    expect(installAgent).toHaveBeenCalledWith('satoru-gojo', { takeoverAtLogin: false });
    expect(stdout.join('\n')).toContain('installed persistent theme satoru-gojo');
    expect(stdout.join('\n')).toContain('/support');
  });

  test('requires explicit opt-in before enabling bounded login takeover', async () => {
    const { io, stdout } = createIo();
    const installAgent = vi.fn(dependencies().installAgent);

    await expect(
      runCli(['install-agent', 'satoru-gojo', '--takeover-at-login'], dependencies({ installAgent }), io),
    ).resolves.toBe(0);

    expect(installAgent).toHaveBeenCalledWith('satoru-gojo', { takeoverAtLogin: true });
    expect(stdout.join('\n')).toContain('login takeover enabled');
  });

  test('rejects unknown install-agent flags', async () => {
    const { io, stderr } = createIo();

    await expect(
      runCli(['install-agent', 'satoru-gojo', '--force'], dependencies(), io),
    ).resolves.toBe(1);

    expect(stderr.join('\n')).toContain('[CLI_ARGUMENT_INVALID]');
  });

  test('switches the saved persistent theme without accepting extra arguments', async () => {
    const { io, stdout } = createIo();
    const switchTheme = vi.fn(dependencies().switchTheme);

    await expect(runCli(['switch', 'satoru-gojo'], dependencies({ switchTheme }), io)).resolves.toBe(0);

    expect(switchTheme).toHaveBeenCalledWith('satoru-gojo');
    expect(stdout.join('\n')).toContain('selected persistent theme satoru-gojo');
  });

  test('upgrades the installed agent without changing its saved enabled state', async () => {
    const { io, stdout } = createIo();
    const upgradeAgent = vi.fn(dependencies().upgradeAgent);

    await expect(runCli(['upgrade-agent'], dependencies({ upgradeAgent }), io)).resolves.toBe(0);

    expect(upgradeAgent).toHaveBeenCalledOnce();
    expect(stdout).toEqual(['upgraded persistent agent to 0.3.0 with satoru-gojo (paused)']);
  });

  test.each([
    ['pause', 'pause', 'paused persistent theme satoru-gojo'],
    ['resume', 'resume', 'resumed persistent theme satoru-gojo'],
  ])('runs the %s lifecycle command', async (command, dependencyName, output) => {
    const { io, stdout } = createIo();
    const operation = vi.fn(dependencies()[dependencyName]);

    await expect(runCli([command], dependencies({ [dependencyName]: operation }), io)).resolves.toBe(0);

    expect(operation).toHaveBeenCalledOnce();
    expect(stdout).toEqual([output]);
  });

  test('reports installed persistent state separately from a session watcher', async () => {
    const { io, stdout } = createIo();

    await expect(
      runCli(
        ['status'],
        dependencies({
          status: async () => ({ installed: true, enabled: true, status: 'active', theme: 'satoru-gojo', port: 9341 }),
        }),
        io,
      ),
    ).resolves.toBe(0);

    expect(stdout).toEqual(['active — persistent satoru-gojo on 127.0.0.1:9341']);
  });

  test('uninstalls only the project-owned persistent service', async () => {
    const { io, stdout } = createIo();
    const uninstallAgent = vi.fn(dependencies().uninstallAgent);

    await expect(runCli(['uninstall-agent'], dependencies({ uninstallAgent }), io)).resolves.toBe(0);

    expect(uninstallAgent).toHaveBeenCalledOnce();
    expect(stdout).toEqual(['uninstalled persistent agent; official Codex data was not changed']);
  });

  test('runs the internal persistent agent only with no public arguments', async () => {
    const { io } = createIo();
    const runAgent = vi.fn(dependencies().runAgent);

    await expect(runCli(['_agent'], dependencies({ runAgent }), io)).resolves.toBe(0);

    expect(runAgent).toHaveBeenCalledOnce();
  });

  test('runs restore without accepting a theme argument', async () => {
    const { io, stdout } = createIo();
    const restore = vi.fn(dependencies().restore);

    await expect(runCli(['restore'], dependencies({ restore }), io)).resolves.toBe(0);
    expect(restore).toHaveBeenCalledOnce();
    expect(stdout.join('\n')).toContain('restored official UI');
  });

  test('reports that restore paused an installed persistent theme', async () => {
    const { io, stdout } = createIo();

    await expect(
      runCli(
        ['restore'],
        dependencies({
          restore: async () => ({
            restored: true,
            persistent: true,
            paused: true,
            theme: 'satoru-gojo',
            liveRemoval: 'removed',
          }),
        }),
        io,
      ),
    ).resolves.toBe(0);

    expect(stdout).toEqual(['paused persistent theme satoru-gojo and restored project-owned styling']);
  });

  test('restores a one-shot apply using the same validated explicit port', async () => {
    const { io, stdout } = createIo();
    const restore = vi.fn(dependencies().restore);

    await expect(runCli(['restore', '--port', '9341'], dependencies({ restore }), io)).resolves.toBe(0);
    expect(restore).toHaveBeenCalledWith(9341);
    expect(stdout.join('\n')).toContain('restored official UI');
  });
});

describe('terminateProcess', () => {
  test('signals the watcher and waits until that exact PID has exited', async () => {
    const signal = vi.fn();
    const exists = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
    const delay = vi.fn(async () => {});

    await expect(terminateProcess(456, { signal, exists, delay, attempts: 3 })).resolves.toBeUndefined();
    expect(signal).toHaveBeenCalledWith(456, 'SIGTERM');
    expect(delay).toHaveBeenCalledOnce();
  });

  test('fails instead of claiming restore while the watcher remains alive', async () => {
    await expect(
      terminateProcess(456, {
        signal: vi.fn(),
        exists: () => true,
        delay: async () => {},
        attempts: 2,
      }),
    ).rejects.toEqual(expect.objectContaining({ code: 'INJECTOR_STOP_TIMEOUT' }));
  });
});

describe('managed renderer readiness', () => {
  test('verifies official port ownership before every renderer query', async () => {
    const events = [];
    const unavailable = Object.assign(new Error('not listening yet'), { code: 'CDP_PORT_UNAVAILABLE' });
    const assertPortOwner = vi
      .fn()
      .mockImplementationOnce(async () => {
        events.push('owner');
        throw unavailable;
      })
      .mockImplementationOnce(async () => {
        events.push('owner');
      });
    const evaluate = vi.fn(async () => {
      events.push('renderer');
      return [{ pass: true }];
    });

    await waitForRenderer(9341, { appPath: '/Applications/ChatGPT.app' }, {
      attempts: 2,
      delayMs: 0,
      assertPortOwner,
      evaluate,
    });

    expect(events).toEqual(['owner', 'owner', 'renderer']);
  });
});

describe('official app launch', () => {
  test('uses LaunchServices and resolves the exact real official app PID', async () => {
    const runOpen = vi.fn(async () => ({ stdout: '', stderr: '' }));
    const listPids = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([123]);

    await expect(launchOfficialApp(
      { appPath: '/Applications/ChatGPT.app' },
      9341,
      { runOpen, listPids, delay: async () => {}, attempts: 2 },
    )).resolves.toEqual({ pid: 123 });

    expect(runOpen).toHaveBeenCalledWith('/usr/bin/open', [
      '-na',
      '/Applications/ChatGPT.app',
      '--args',
      '--remote-debugging-address=127.0.0.1',
      '--remote-debugging-port=9341',
    ]);
  });

  test('fails closed if LaunchServices creates ambiguous official app processes', async () => {
    await expect(launchOfficialApp(
      { appPath: '/Applications/ChatGPT.app' },
      9341,
      {
        runOpen: async () => ({ stdout: '', stderr: '' }),
        listPids: async () => [123, 124],
        delay: async () => {},
        attempts: 1,
      },
    )).resolves.toEqual({ pid: null });
  });

  test('requests a normal app quit only while the exact single official PID is unchanged', async () => {
    const runCommand = vi.fn(async () => ({ stdout: '', stderr: '' }));
    const app = { bundleId: 'com.openai.codex' };

    await expect(requestOfficialAppQuit(app, 123, {
      listPids: async () => [123],
      runCommand,
    })).resolves.toBeUndefined();

    expect(runCommand).toHaveBeenCalledWith('/usr/bin/osascript', [
      '-e',
      'tell application id "com.openai.codex" to quit',
    ], { encoding: 'utf8' });

    await expect(requestOfficialAppQuit(app, 123, {
      listPids: async () => [124],
      runCommand,
    })).rejects.toEqual(expect.objectContaining({ code: 'APP_PROCESS_CHANGED' }));
    expect(runCommand).toHaveBeenCalledTimes(1);
  });

  test('confirms complete app exit and rejects PID replacement during takeover', async () => {
    await expect(waitForOfficialAppExit({}, 123, {
      listPids: vi.fn().mockResolvedValueOnce([123]).mockResolvedValueOnce([]),
      delay: async () => {},
      attempts: 2,
    })).resolves.toBe(true);

    await expect(waitForOfficialAppExit({}, 123, {
      listPids: async () => [124],
      delay: async () => {},
      attempts: 1,
    })).resolves.toBe(false);
  });
});

describe('startup takeover gate', () => {
  test('allows exactly one attempt inside the configured boot window', () => {
    const gate = createStartupTakeoverGate({ uptime: () => 30 });

    expect(gate(120)).toBe(true);
    expect(gate(120)).toBe(false);
  });

  test('rejects attempts outside the boot window and malformed windows', () => {
    expect(createStartupTakeoverGate({ uptime: () => 121 })(120)).toBe(false);
    expect(createStartupTakeoverGate({ uptime: () => 1 })(0)).toBe(false);
    expect(createStartupTakeoverGate({ uptime: () => 1 })(301)).toBe(false);
  });
});
