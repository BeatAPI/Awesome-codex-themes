import { readAgentConfig } from './config.mjs';
import { writeAgentState } from './agent-state.mjs';

const LOST_MANAGED_ENDPOINT_ERRORS = new Set([
  'CDP_PORT_UNAVAILABLE',
  'CDP_PORT_OWNER_INVALID',
  'CDP_LISTENER_UNSAFE',
]);

function observedState({ status, themeSlug, appPid = null, appVersion = null, port = null, errorCode = null }, now) {
  return {
    schemaVersion: 1,
    status,
    themeSlug,
    appPid,
    appVersion,
    port,
    errorCode,
    updatedAt: now(),
  };
}

function failureStatus() {
  return 'error';
}

export async function agentStep({ config, runtime }, dependencies) {
  const {
    discoverApp,
    listPids,
    selectPort,
    launchApp,
    waitForRenderer,
    assertPortOwner,
    applyTheme,
    removeTheme,
    now = () => new Date().toISOString(),
  } = dependencies;

  const app = await discoverApp();
  const runningPids = await listPids(app);

  if (!config.enabled) {
    let pausedRuntime = null;
    if (runtime && runningPids.includes(runtime.appPid)) {
      try {
        await assertPortOwner(app, runtime.port);
        await removeTheme({ port: runtime.port, app });
        pausedRuntime = { ...runtime, themeSlug: config.themeSlug };
      } catch {
        // Pausing must not broaden process control when the recorded endpoint is gone.
      }
    }
    return {
      runtime: pausedRuntime,
      state: observedState(
        {
          status: 'paused',
          themeSlug: config.themeSlug,
          appPid: pausedRuntime?.appPid ?? null,
          appVersion: app.version,
          port: pausedRuntime?.port ?? null,
        },
        now,
      ),
    };
  }

  let managed = runtime && runningPids.includes(runtime.appPid) ? runtime : null;
  if (!managed && runningPids.length > 0) {
    return {
      runtime: null,
      state: observedState(
        {
          status: 'restart-required',
          themeSlug: config.themeSlug,
          appPid: runningPids[0],
          appVersion: app.version,
          errorCode: 'APP_RUNNING_WITHOUT_MANAGED_CDP',
        },
        now,
      ),
    };
  }

  if (!managed) {
    const port = await selectPort();
    const launched = await launchApp(app, port);
    if (!Number.isInteger(launched?.pid) || launched.pid < 1) {
      const error = Object.assign(new Error('The official app did not return a valid PID.'), { code: 'APP_LAUNCH_FAILED' });
      return {
        runtime: null,
        state: observedState(
          { status: 'error', themeSlug: config.themeSlug, appVersion: app.version, errorCode: error.code },
          now,
        ),
      };
    }
    managed = { appPid: launched.pid, port, themeSlug: config.themeSlug };
    try {
      await waitForRenderer(port, app);
    } catch (error) {
      return {
        runtime: managed,
        state: observedState(
          {
            status: failureStatus(error),
            themeSlug: config.themeSlug,
            appPid: managed.appPid,
            appVersion: app.version,
            port,
            errorCode: error?.code ?? 'UNEXPECTED_ERROR',
          },
          now,
        ),
      };
    }
  }

  try {
    await assertPortOwner(app, managed.port);
    await applyTheme({ themeSlug: config.themeSlug, port: managed.port, app });
    const nextRuntime = { ...managed, themeSlug: config.themeSlug };
    return {
      runtime: nextRuntime,
      state: observedState(
        {
          status: 'active',
          themeSlug: config.themeSlug,
          appPid: nextRuntime.appPid,
          appVersion: app.version,
          port: nextRuntime.port,
        },
        now,
      ),
    };
  } catch (error) {
    const nextRuntime = LOST_MANAGED_ENDPOINT_ERRORS.has(error?.code)
      ? null
      : { ...managed, themeSlug: config.themeSlug };
    return {
      runtime: nextRuntime,
      state: observedState(
        {
          status: failureStatus(error),
          themeSlug: config.themeSlug,
          appPid: managed.appPid,
          appVersion: app.version,
          port: managed.port,
          errorCode: error?.code ?? 'UNEXPECTED_ERROR',
        },
        now,
      ),
    };
  }
}

export async function runPersistentAgent(
  { configPath, statePath, intervalMs = 1_500, initialRuntime = null },
  {
    readConfig = readAgentConfig,
    writeState = writeAgentState,
    stepDependencies,
    delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    shouldStop = () => false,
  },
) {
  let runtime = initialRuntime;
  while (!shouldStop()) {
    const config = await readConfig(configPath);
    const result = await agentStep({ config, runtime }, stepDependencies);
    runtime = result.runtime;
    await writeState(statePath, result.state);
    await delay(intervalMs);
  }
  return { stopped: true, runtime };
}
