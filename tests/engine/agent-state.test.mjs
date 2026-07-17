import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  AgentStateError,
  isActiveAgentStateLive,
  readAgentState,
  validateAgentState,
  writeAgentState,
} from '../../src/engine/agent-state.mjs';

const tempDirs = [];

function validState(overrides = {}) {
  return {
    schemaVersion: 1,
    status: 'active',
    themeSlug: 'satoru-gojo',
    appPid: 123,
    appVersion: '26.707.91948',
    port: 9341,
    errorCode: null,
    updatedAt: '2026-07-17T00:00:00.000Z',
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('agent observed state', () => {
  test('accepts active and paused state shapes', () => {
    expect(validateAgentState(validState()).status).toBe('active');
    expect(validateAgentState(validState({ status: 'paused', appPid: null, appVersion: null, port: null })).status).toBe('paused');
  });

  test.each([
    [{ status: 'unknown' }, 'AGENT_STATE_STATUS_INVALID'],
    [{ status: 'unsupported-version' }, 'AGENT_STATE_STATUS_INVALID'],
    [{ appPid: -1 }, 'AGENT_STATE_PID_INVALID'],
    [{ port: 80 }, 'AGENT_STATE_PORT_INVALID'],
    [{ themeSlug: '../escape' }, 'AGENT_STATE_THEME_INVALID'],
  ])('rejects malformed observed state', (overrides, code) => {
    expect(() => validateAgentState(validState(overrides))).toThrowError(expect.objectContaining({ code }));
  });

  test('persists state with owner-only permissions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'awesome-codex-agent-state-'));
    tempDirs.push(root);
    const path = join(root, 'agent-state.json');

    await writeAgentState(path, validState());

    expect(await readAgentState(path)).toEqual(validState());
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  test('uses a typed error when the file is missing', async () => {
    await expect(readAgentState('/missing/agent-state.json')).rejects.toBeInstanceOf(AgentStateError);
  });

  test('calls an active state live only when version, PID, and port ownership are current', async () => {
    const app = { version: '26.707.91948' };
    const assertPortOwner = vi.fn(async () => {});
    const dependencies = {
      discoverApp: async () => app,
      listPids: async () => [123],
      assertPortOwner,
      isAgentLoaded: async () => true,
    };

    await expect(isActiveAgentStateLive(validState(), dependencies)).resolves.toBe(true);
    expect(assertPortOwner).toHaveBeenCalledWith(app, 9341);

    await expect(
      isActiveAgentStateLive(validState({ appVersion: '26.706.1' }), dependencies),
    ).resolves.toBe(false);
    await expect(
      isActiveAgentStateLive(validState(), { ...dependencies, listPids: async () => [] }),
    ).resolves.toBe(false);
    await expect(
      isActiveAgentStateLive(validState(), { ...dependencies, isAgentLoaded: async () => false }),
    ).resolves.toBe(false);
    await expect(
      isActiveAgentStateLive(validState(), {
        ...dependencies,
        assertPortOwner: async () => {
          throw Object.assign(new Error('stale'), { code: 'CDP_PORT_UNAVAILABLE' });
        },
      }),
    ).resolves.toBe(false);
  });
});
