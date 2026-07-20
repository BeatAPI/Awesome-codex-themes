import { describe, expect, test, vi } from 'vitest';

import { agentStep, runPersistentAgent } from '../../src/engine/agent.mjs';

function config(overrides = {}) {
  return {
    schemaVersion: 1,
    enabled: true,
    themeSlug: 'satoru-gojo',
    launchAtLogin: true,
    takeoverAtLogin: false,
    startupTakeoverWindowSeconds: 120,
    ...overrides,
  };
}

function app() {
  return { appPath: '/Applications/ChatGPT.app', version: '26.707.91948', executable: '/Applications/ChatGPT.app/Contents/MacOS/ChatGPT' };
}

function dependencies(overrides = {}) {
  return {
    discoverApp: vi.fn(async () => app()),
    listPids: vi.fn(async () => []),
    selectPort: vi.fn(async () => 9341),
    launchApp: vi.fn(async () => ({ pid: 123 })),
    waitForRenderer: vi.fn(async () => {}),
    assertPortOwner: vi.fn(async () => {}),
    applyTheme: vi.fn(async ({ themeSlug }) => ({ theme: themeSlug, renderers: 1 })),
    removeTheme: vi.fn(async () => ({ restored: true })),
    startupTakeoverAllowed: vi.fn(() => false),
    requestAppQuit: vi.fn(async () => {}),
    waitForAppExit: vi.fn(async () => true),
    now: () => '2026-07-17T00:00:00.000Z',
    ...overrides,
  };
}

describe('persistent agent state machine', () => {
  test('launches an absent official app with CDP and applies the selected theme', async () => {
    const deps = dependencies();

    const result = await agentStep({ config: config(), runtime: null }, deps);

    expect(deps.launchApp).toHaveBeenCalledWith(app(), 9341);
    expect(deps.assertPortOwner).toHaveBeenCalledWith(app(), 9341);
    expect(deps.applyTheme).toHaveBeenCalledWith({ themeSlug: 'satoru-gojo', port: 9341, app: app() });
    expect(result.runtime).toEqual({ appPid: 123, port: 9341, themeSlug: 'satoru-gojo' });
    expect(result.state).toEqual({
      schemaVersion: 1,
      status: 'active',
      themeSlug: 'satoru-gojo',
      appPid: 123,
      appVersion: '26.707.91948',
      port: 9341,
      errorCode: null,
      updatedAt: '2026-07-17T00:00:00.000Z',
    });
  });

  test('reapplies idempotently to a managed renderer after reload', async () => {
    const deps = dependencies({ listPids: vi.fn(async () => [123]) });
    const runtime = { appPid: 123, port: 9341, themeSlug: 'satoru-gojo' };

    const result = await agentStep({ config: config(), runtime }, deps);

    expect(deps.launchApp).not.toHaveBeenCalled();
    expect(deps.applyTheme).toHaveBeenCalledOnce();
    expect(result.state.status).toBe('active');
  });

  test('switches the selected theme on the existing managed renderer', async () => {
    const deps = dependencies({ listPids: vi.fn(async () => [123]) });
    const runtime = { appPid: 123, port: 9341, themeSlug: 'old-theme' };

    const result = await agentStep({ config: config({ themeSlug: 'satoru-gojo' }), runtime }, deps);

    expect(deps.applyTheme).toHaveBeenCalledWith({ themeSlug: 'satoru-gojo', port: 9341, app: app() });
    expect(result.runtime.themeSlug).toBe('satoru-gojo');
  });

  test('reports restart required for an unmanaged running app and never terminates it', async () => {
    const terminate = vi.fn();
    const deps = dependencies({ listPids: vi.fn(async () => [777]), terminate });

    const result = await agentStep({ config: config(), runtime: null }, deps);

    expect(result.state.status).toBe('restart-required');
    expect(result.runtime).toBeNull();
    expect(deps.launchApp).not.toHaveBeenCalled();
    expect(terminate).not.toHaveBeenCalled();
  });

  test('takes over one macOS-restored official app once during an explicitly enabled login window', async () => {
    const deps = dependencies({
      listPids: vi.fn(async () => [777]),
      startupTakeoverAllowed: vi.fn(() => true),
    });

    const result = await agentStep({
      config: config({ takeoverAtLogin: true }),
      runtime: null,
    }, deps);

    expect(deps.startupTakeoverAllowed).toHaveBeenCalledWith(120);
    expect(deps.requestAppQuit).toHaveBeenCalledWith(app(), 777);
    expect(deps.waitForAppExit).toHaveBeenCalledWith(app(), 777);
    expect(deps.launchApp).not.toHaveBeenCalled();
    expect(result).toEqual({
      runtime: null,
      state: expect.objectContaining({ status: 'starting', appPid: null, errorCode: null }),
    });
  });

  test('does not take over outside the bounded startup window', async () => {
    const deps = dependencies({
      listPids: vi.fn(async () => [777]),
      startupTakeoverAllowed: vi.fn(() => false),
    });

    const result = await agentStep({
      config: config({ takeoverAtLogin: true }),
      runtime: null,
    }, deps);

    expect(deps.requestAppQuit).not.toHaveBeenCalled();
    expect(result.state).toEqual(expect.objectContaining({
      status: 'restart-required',
      errorCode: 'APP_RUNNING_WITHOUT_MANAGED_CDP',
    }));
  });

  test('fails closed when startup takeover cannot confirm the exact official PID exited', async () => {
    const deps = dependencies({
      listPids: vi.fn(async () => [777]),
      startupTakeoverAllowed: vi.fn(() => true),
      waitForAppExit: vi.fn(async () => false),
    });

    const result = await agentStep({
      config: config({ takeoverAtLogin: true }),
      runtime: null,
    }, deps);

    expect(deps.launchApp).not.toHaveBeenCalled();
    expect(result.state).toEqual(expect.objectContaining({
      status: 'restart-required',
      appPid: 777,
      errorCode: 'APP_STARTUP_TAKEOVER_FAILED',
    }));
  });

  test('never takes over when more than one official app process is observed', async () => {
    const deps = dependencies({
      listPids: vi.fn(async () => [777, 778]),
      startupTakeoverAllowed: vi.fn(() => true),
    });

    const result = await agentStep({
      config: config({ takeoverAtLogin: true }),
      runtime: null,
    }, deps);

    expect(deps.startupTakeoverAllowed).not.toHaveBeenCalled();
    expect(deps.requestAppQuit).not.toHaveBeenCalled();
    expect(result.state).toEqual(expect.objectContaining({
      status: 'restart-required',
      errorCode: 'APP_MULTIPLE_INSTANCES',
    }));
  });

  test('keeps retrying after official app discovery is temporarily unavailable at login', async () => {
    const missing = Object.assign(new Error('updating'), { code: 'APP_NOT_FOUND' });
    const deps = dependencies({ discoverApp: vi.fn(async () => { throw missing; }) });

    const result = await agentStep({ config: config(), runtime: null }, deps);

    expect(result.runtime).toBeNull();
    expect(result.state).toEqual(expect.objectContaining({ status: 'error', errorCode: 'APP_NOT_FOUND' }));
  });

  test('pauses without launching, removes owned styling, and retains a reachable managed endpoint for resume', async () => {
    const deps = dependencies({ listPids: vi.fn(async () => [123]) });
    const runtime = { appPid: 123, port: 9341, themeSlug: 'satoru-gojo' };

    const result = await agentStep({ config: config({ enabled: false }), runtime }, deps);

    expect(deps.removeTheme).toHaveBeenCalledWith({ port: 9341, app: app() });
    expect(deps.launchApp).not.toHaveBeenCalled();
    expect(result).toEqual({
      runtime,
      state: expect.objectContaining({
        status: 'paused',
        appPid: 123,
        port: 9341,
      }),
    });

    const resumed = await agentStep({ config: config({ enabled: true }), runtime: result.runtime }, deps);
    expect(resumed.state.status).toBe('active');
    expect(deps.launchApp).not.toHaveBeenCalled();
  });

  test('reports a normal typed error when a best-effort renderer cannot be verified', async () => {
    const unverified = Object.assign(new Error('unverified'), { code: 'THEME_APPLY_UNVERIFIED' });
    const deps = dependencies({ applyTheme: vi.fn(async () => { throw unverified; }) });

    const result = await agentStep({ config: config(), runtime: null }, deps);

    expect(result.state.status).toBe('error');
    expect(result.state.errorCode).toBe('THEME_APPLY_UNVERIFIED');
    expect(result.runtime).toEqual({ appPid: 123, port: 9341, themeSlug: 'satoru-gojo' });
  });

  test('starts a new managed process after the previous app exits', async () => {
    const deps = dependencies({ launchApp: vi.fn(async () => ({ pid: 456 })) });
    const runtime = { appPid: 123, port: 9341, themeSlug: 'satoru-gojo' };

    const result = await agentStep({ config: config(), runtime }, deps);

    expect(deps.launchApp).toHaveBeenCalledOnce();
    expect(result.runtime.appPid).toBe(456);
  });

  test('forgets a stale persisted endpoint and transitions to restart-required', async () => {
    const staleEndpoint = Object.assign(new Error('listener is gone'), { code: 'CDP_PORT_UNAVAILABLE' });
    const deps = dependencies({
      listPids: vi.fn(async () => [123]),
      assertPortOwner: vi.fn(async () => { throw staleEndpoint; }),
    });
    const runtime = { appPid: 123, port: 9341, themeSlug: 'satoru-gojo' };

    const failed = await agentStep({ config: config(), runtime }, deps);
    expect(failed.runtime).toBeNull();
    expect(failed.state).toEqual(expect.objectContaining({ status: 'error', errorCode: 'CDP_PORT_UNAVAILABLE' }));

    const recovered = await agentStep({ config: config(), runtime: failed.runtime }, deps);
    expect(recovered.runtime).toBeNull();
    expect(recovered.state.status).toBe('restart-required');
    expect(deps.launchApp).not.toHaveBeenCalled();
  });
});

describe('persistent agent loop', () => {
  test('reloads desired configuration and writes observed state on every iteration', async () => {
    const readConfig = vi
      .fn()
      .mockResolvedValueOnce(config())
      .mockResolvedValueOnce(config({ enabled: false }));
    const writeState = vi.fn(async () => {});
    const delay = vi.fn(async () => {});
    let checks = 0;

    await runPersistentAgent(
      { configPath: '/config.json', statePath: '/state.json', intervalMs: 10 },
      {
        readConfig,
        writeState,
        stepDependencies: dependencies(),
        delay,
        shouldStop: () => checks++ >= 2,
      },
    );

    expect(readConfig).toHaveBeenCalledTimes(2);
    expect(writeState).toHaveBeenCalledTimes(2);
    expect(writeState.mock.calls[0][1].status).toBe('active');
    expect(writeState.mock.calls[1][1].status).toBe('paused');
    expect(delay).toHaveBeenCalledTimes(2);
  });
});
