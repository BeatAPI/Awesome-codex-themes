import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

import {
  RuntimeStateError,
  matchesProcessIdentity,
  readRuntimeState,
  validateRuntimeState,
  writeRuntimeState,
} from '../../src/engine/state.mjs';

const tempDirs = [];

function validState(overrides = {}) {
  return {
    schemaVersion: 1,
    appPath: '/Applications/ChatGPT.app',
    appVersion: '26.707.72221',
    appPid: 123,
    appStartedAt: 'Thu Jul 16 09:39:00 2026',
    port: 9341,
    themeSlug: 'obsidian-bloom',
    injectorPid: 456,
    injectorStartedAt: 'Thu Jul 16 09:40:00 2026',
    injectorExecutable: '/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node',
    injectorScript: '/opt/awesome-codex-themes/src/cli/main.mjs',
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('validateRuntimeState', () => {
  test('accepts a complete versioned state record', () => {
    expect(validateRuntimeState(validState()).themeSlug).toBe('obsidian-bloom');
  });

  test.each([
    [{ port: 0 }, 'STATE_PORT_INVALID'],
    [{ appPid: -1 }, 'STATE_PID_INVALID'],
    [{ themeSlug: '../escape' }, 'STATE_THEME_INVALID'],
    [{ appPath: 'ChatGPT.app' }, 'STATE_PATH_INVALID'],
  ])('rejects malformed fields with stable codes', (overrides, code) => {
    expect(() => validateRuntimeState(validState(overrides))).toThrowError(
      expect.objectContaining({ code }),
    );
  });
});

describe('process identity', () => {
  test('requires every recorded identity field to match', () => {
    const state = validState();
    const observed = {
      pid: 456,
      startedAt: state.injectorStartedAt,
      executable: state.injectorExecutable,
      script: state.injectorScript,
    };

    expect(matchesProcessIdentity(state, observed)).toBe(true);
    expect(matchesProcessIdentity(state, { ...observed, startedAt: 'later' })).toBe(false);
    expect(matchesProcessIdentity(state, { ...observed, executable: '/tmp/node' })).toBe(false);
  });
});

describe('state persistence', () => {
  test('writes atomically with owner-only permissions and reads it back', async () => {
    const root = await mkdtemp(join(tmpdir(), 'awesome-codex-state-'));
    tempDirs.push(root);
    const path = join(root, 'state.json');

    await writeRuntimeState(path, validState());

    expect(await readRuntimeState(path)).toEqual(validState());
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect(JSON.parse(await readFile(path, 'utf8')).schemaVersion).toBe(1);
  });

  test('uses a typed error for malformed state JSON', async () => {
    const root = await mkdtemp(join(tmpdir(), 'awesome-codex-state-'));
    tempDirs.push(root);
    const path = join(root, 'state.json');
    await writeRuntimeState(path, validState());
    await import('node:fs/promises').then(({ writeFile }) => writeFile(path, '{bad'));

    await expect(readRuntimeState(path)).rejects.toBeInstanceOf(RuntimeStateError);
  });
});
