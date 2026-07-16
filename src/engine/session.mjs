import { join } from 'node:path';

import { evaluateOnRendererTargets } from './cdp.mjs';
import {
  buildApplyExpression,
  buildRemoveExpression,
} from './injection.mjs';
import { matchesProcessIdentity } from './state.mjs';
import { assertThemeCompatibility, loadThemePackage } from './theme.mjs';

export class SessionError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'SessionError';
    this.code = code;
  }
}

function sessionFail(code, message, options) {
  throw new SessionError(code, message, options);
}

export async function applyThemeAtPort({
  themesRoot,
  themeSlug,
  port,
  appVersion,
  evaluate = evaluateOnRendererTargets,
}) {
  const theme = await loadThemePackage(join(themesRoot, themeSlug));
  if (theme.manifest.slug !== themeSlug) {
    sessionFail('THEME_SLUG_MISMATCH', 'Theme directory and manifest slug must match.');
  }
  assertThemeCompatibility(theme.manifest, { platform: 'macos', appVersion });
  const results = await evaluate({ port, expression: buildApplyExpression(theme) });
  if (
    !Array.isArray(results) ||
    results.length === 0 ||
    results.some((result) => !result?.pass || result.theme !== themeSlug)
  ) {
    sessionFail('THEME_APPLY_UNVERIFIED', 'The renderer did not confirm the requested theme marker.');
  }
  return { theme: themeSlug, renderers: results.length };
}

export async function removeThemeAtPort({ port, evaluate = evaluateOnRendererTargets }) {
  const results = await evaluate({ port, expression: buildRemoveExpression() });
  if (!Array.isArray(results) || results.length === 0 || results.some((result) => !result?.pass)) {
    sessionFail('RESTORE_INCOMPLETE', 'One or more renderers did not confirm theme removal.');
  }
  return { restored: true, renderers: results.length };
}

export async function startThemeSession(
  { themeSlug, statePath },
  {
    discoverApp,
    listPids,
    selectPort,
    launchApp,
    processStartedAt,
    waitForRenderer,
    applyTheme,
    spawnWatcher,
    writeState,
  },
) {
  const app = await discoverApp();
  const runningPids = await listPids(app);
  if (runningPids.length > 0) {
    sessionFail(
      'APP_ALREADY_RUNNING',
      'Codex is already running. Quit it explicitly before starting a themed session; no process was terminated.',
    );
  }

  const port = await selectPort();
  const launched = await launchApp(app, port);
  const appPid = launched?.pid;
  if (!Number.isInteger(appPid) || appPid < 1) sessionFail('APP_LAUNCH_FAILED', 'The official app did not return a valid PID.');
  const appStartedAt = await processStartedAt(appPid);

  await waitForRenderer(port);
  await applyTheme({ themeSlug, port, app });
  const watcher = await spawnWatcher({ themeSlug, port, appPid, app });
  if (!Number.isInteger(watcher?.pid) || watcher.pid < 1) {
    sessionFail('INJECTOR_LAUNCH_FAILED', 'The theme watcher did not return a valid PID.');
  }
  const watcherStartedAt = await processStartedAt(watcher.pid);

  await writeState(statePath, {
    schemaVersion: 1,
    appPath: app.appPath,
    appVersion: app.version,
    appPid,
    appStartedAt,
    port,
    themeSlug,
    injectorPid: watcher.pid,
    injectorStartedAt: watcherStartedAt,
    injectorExecutable: watcher.executable,
    injectorScript: watcher.script,
  });

  return { theme: themeSlug, port, appPid, watcherPid: watcher.pid };
}

export async function restoreThemeSession(
  { statePath },
  { readState, observeInjector, removeTheme, killInjector, removeState },
) {
  const state = await readState(statePath);
  await removeTheme(state.port);

  const observed = await observeInjector(state.injectorPid);
  if (observed === null) {
    await removeState(statePath);
    return { restored: true, theme: state.themeSlug };
  }
  if (!matchesProcessIdentity(state, observed)) {
    sessionFail(
      'INJECTOR_IDENTITY_MISMATCH',
      'Live theme CSS was removed, but the recorded watcher PID changed identity and was not terminated.',
    );
  }

  await killInjector(state.injectorPid);
  await removeState(statePath);
  return { restored: true, theme: state.themeSlug };
}
