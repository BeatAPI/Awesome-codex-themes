import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  SessionError,
  applyThemeAtPort,
  restoreThemeSession,
  startThemeSession,
} from '../../src/engine/session.mjs';

const tempDirs = [];

function appInspection() {
  return {
    appPath: '/Applications/ChatGPT.app',
    executable: '/Applications/ChatGPT.app/Contents/MacOS/ChatGPT',
    nodePath: '/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node',
    bundleId: 'com.openai.codex',
    version: '26.707.72221',
    teamId: '2DC432GLL2',
    signatureValid: true,
    nodeVersion: '22.16.0',
    nodeArch: 'arm64',
    hostArch: 'arm64',
  };
}

function runtimeState(overrides = {}) {
  return {
    schemaVersion: 1,
    appPath: '/Applications/ChatGPT.app',
    appVersion: '26.707.72221',
    appPid: 123,
    appStartedAt: 'app-start',
    port: 9341,
    themeSlug: 'test-theme',
    injectorPid: 456,
    injectorStartedAt: 'watcher-start',
    injectorExecutable: '/trusted/node',
    injectorScript: '/trusted/main.mjs',
    ...overrides,
  };
}

async function createThemeRoot() {
  const themesRoot = await mkdtemp(join(tmpdir(), 'awesome-codex-session-'));
  tempDirs.push(themesRoot);
  const root = join(themesRoot, 'test-theme');
  await import('node:fs/promises').then(({ mkdir }) => mkdir(root, { recursive: true }));
  await writeFile(
    join(root, 'theme.json'),
    JSON.stringify({
      schemaVersion: 1,
      slug: 'test-theme',
      version: '1.0.0',
      name: 'Test Theme',
      description: 'A test theme.',
      author: { name: 'Tests' },
      license: { code: 'MIT', artwork: 'CC0-1.0' },
      categories: ['dark'],
      tags: ['test'],
      compatibility: {
        platforms: ['macos'],
        status: 'experimental',
        strategy: 'best-effort-all',
        verifiedAppVersions: ['26.707.*'],
      },
      palette: { background: '#000000', surface: '#111111CC', text: '#FFFFFF', accent: '#00FFAA' },
      files: { css: 'theme.css', artwork: 'background.svg', preview: 'preview.svg' },
    }),
  );
  await writeFile(join(root, 'theme.css'), '.awesome-codex-theme { background: var(--act-artwork); }');
  await writeFile(join(root, 'background.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  await writeFile(join(root, 'preview.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  return themesRoot;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('applyThemeAtPort', () => {
  test('loads a local theme and requires a verified renderer result', async () => {
    const themesRoot = await createThemeRoot();
    const evaluate = vi.fn(async ({ port, expression }) => {
      expect(expression).toContain('awesome-codex-theme-style');
      expect(expression).toContain('--color-token-main-surface-primary');
      return [{ pass: true, theme: 'test-theme', adapter: 'codex-26.707' }];
    });

    await expect(applyThemeAtPort({ themesRoot, themeSlug: 'test-theme', port: 9341, appVersion: '26.707.72221', evaluate })).resolves.toEqual(
      expect.objectContaining({ theme: 'test-theme', adapter: 'codex-26.707', renderers: 1 }),
    );
    expect(evaluate).toHaveBeenCalledWith(expect.objectContaining({ port: 9341 }));
  });

  test('fails when a renderer does not confirm the theme marker', async () => {
    const themesRoot = await createThemeRoot();
    await expect(
      applyThemeAtPort({
        themesRoot,
        themeSlug: 'test-theme',
        port: 9341,
        appVersion: '26.707.72221',
        evaluate: async () => [{ pass: false }],
      }),
    ).rejects.toEqual(expect.objectContaining({ code: 'THEME_APPLY_UNVERIFIED' }));
  });

  test('attempts the shared best-effort adapter on an unverified numeric app version', async () => {
    const themesRoot = await createThemeRoot();
    const evaluate = vi.fn(async ({ expression }) => {
      expect(expression).toContain('codex-best-effort');
      return [{ pass: true, theme: 'test-theme', adapter: 'codex-best-effort' }];
    });

    await expect(
      applyThemeAtPort({
        themesRoot,
        themeSlug: 'test-theme',
        port: 9341,
        appVersion: '99.1.2',
        evaluate,
      }),
    ).resolves.toEqual({ theme: 'test-theme', adapter: 'codex-best-effort', renderers: 1 });
  });
});

describe('startThemeSession', () => {
  test('never launches another app while the official app is already running', async () => {
    const launchApp = vi.fn();
    await expect(
      startThemeSession(
        { themeSlug: 'test-theme', statePath: '/tmp/state.json' },
        {
          discoverApp: async () => appInspection(),
          listPids: async () => [123],
          launchApp,
        },
      ),
    ).rejects.toEqual(expect.objectContaining({ code: 'APP_ALREADY_RUNNING' }));
    expect(launchApp).not.toHaveBeenCalled();
  });

  test('applies before persisting a watcher-owned state record', async () => {
    const calls = [];
    const writeState = vi.fn(async (_path, state) => calls.push(['write', state]));

    const result = await startThemeSession(
      { themeSlug: 'test-theme', statePath: '/tmp/state.json' },
      {
        discoverApp: async () => appInspection(),
        listPids: async () => [],
        selectPort: async () => 9341,
        launchApp: async () => ({ pid: 123 }),
        processStartedAt: async (pid) => (pid === 123 ? 'app-start' : 'watcher-start'),
        waitForRenderer: async () => calls.push(['wait']),
        applyTheme: async () => calls.push(['apply']),
        spawnWatcher: async () => ({ pid: 456, executable: '/trusted/node', script: '/trusted/main.mjs' }),
        writeState,
      },
    );

    expect(calls.map(([name]) => name)).toEqual(['wait', 'apply', 'write']);
    expect(writeState).toHaveBeenCalledWith('/tmp/state.json', runtimeState());
    expect(result).toEqual(expect.objectContaining({ port: 9341, theme: 'test-theme', appPid: 123 }));
  });

  test('rolls back only owned theme and watcher state when persistence fails', async () => {
    let watcherStopped = false;
    const removeTheme = vi.fn(async () => {
      if (!watcherStopped) throw new Error('watcher can still reapply');
    });
    const stopWatcher = vi.fn(async () => {
      await Promise.resolve();
      watcherStopped = true;
    });

    await expect(
      startThemeSession(
        { themeSlug: 'test-theme', statePath: '/tmp/state.json' },
        {
          discoverApp: async () => appInspection(),
          listPids: async () => [],
          selectPort: async () => 9341,
          launchApp: async () => ({ pid: 123 }),
          processStartedAt: async (pid) => (pid === 123 ? 'app-start' : 'watcher-start'),
          waitForRenderer: async () => {},
          applyTheme: async () => {},
          spawnWatcher: async () => ({ pid: 456, executable: '/trusted/node', script: '/trusted/main.mjs' }),
          writeState: async () => {
            throw new Error('disk full');
          },
          removeTheme,
          stopWatcher,
        },
      ),
    ).rejects.toEqual(expect.objectContaining({ code: 'SESSION_START_ROLLED_BACK' }));

    expect(stopWatcher).toHaveBeenCalledWith(456);
    expect(removeTheme).toHaveBeenCalledWith(9341, appInspection());
  });
});

describe('restoreThemeSession', () => {
  test('removes the theme and stops only the exact recorded watcher', async () => {
    const calls = [];
    const removeTheme = vi.fn(async () => calls.push('remove-theme'));
    const killInjector = vi.fn(async () => calls.push('stop-watcher'));
    const removeState = vi.fn(async () => calls.push('remove-state'));

    await expect(
      restoreThemeSession(
        { statePath: '/tmp/state.json' },
        {
          readState: async () => runtimeState(),
          observeInjector: async () => {
            calls.push('observe-watcher');
            return {
              pid: 456,
              startedAt: 'watcher-start',
              executable: '/trusted/node',
              script: '/trusted/main.mjs',
            };
          },
          removeTheme,
          killInjector,
          removeState,
        },
      ),
    ).resolves.toEqual({ restored: true, theme: 'test-theme' });

    expect(removeTheme).toHaveBeenCalledWith(9341);
    expect(killInjector).toHaveBeenCalledWith(456);
    expect(removeState).toHaveBeenCalledWith('/tmp/state.json');
    expect(calls).toEqual(['observe-watcher', 'stop-watcher', 'remove-theme', 'remove-state']);
  });

  test('still removes live CSS but refuses to terminate a PID with changed identity', async () => {
    const removeTheme = vi.fn(async () => {});
    const killInjector = vi.fn();

    await expect(
      restoreThemeSession(
        { statePath: '/tmp/state.json' },
        {
          readState: async () => runtimeState(),
          observeInjector: async () => ({
            pid: 456,
            startedAt: 'different',
            executable: '/trusted/node',
            script: '/trusted/main.mjs',
          }),
          removeTheme,
          killInjector,
          removeState: vi.fn(),
        },
      ),
    ).rejects.toBeInstanceOf(SessionError);

    expect(removeTheme).toHaveBeenCalledWith(9341);
    expect(killInjector).not.toHaveBeenCalled();
  });

  test('cleans state safely when the recorded watcher has already exited', async () => {
    const removeTheme = vi.fn(async () => {});
    const killInjector = vi.fn();
    const removeState = vi.fn(async () => {});

    await expect(
      restoreThemeSession(
        { statePath: '/tmp/state.json' },
        {
          readState: async () => runtimeState(),
          observeInjector: async () => null,
          removeTheme,
          killInjector,
          removeState,
        },
      ),
    ).resolves.toEqual({ restored: true, theme: 'test-theme' });

    expect(removeTheme).toHaveBeenCalledWith(9341);
    expect(killInjector).not.toHaveBeenCalled();
    expect(removeState).toHaveBeenCalledOnce();
  });
});
