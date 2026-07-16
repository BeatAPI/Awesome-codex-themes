import { execFile } from 'node:child_process';
import { readdir, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { spawn } from 'node:child_process';

import { evaluateOnRendererTargets, findAvailablePort } from '../engine/cdp.mjs';
import {
  assertOfficialPortOwner,
  discoverOfficialApp,
  listOfficialAppPids,
  processStartedAt,
} from '../engine/macos.mjs';
import {
  applyThemeAtPort,
  removeThemeAtPort,
  restoreThemeSession,
  startThemeSession,
} from '../engine/session.mjs';
import { matchesProcessIdentity, readRuntimeState, writeRuntimeState } from '../engine/state.mjs';
import { loadThemePackage } from '../engine/theme.mjs';

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(cliPath), '../..');
const themesRoot = join(projectRoot, 'themes');
const statePath = join(homedir(), 'Library/Application Support/AwesomeCodexThemes/state.json');
const RETRYABLE_CDP_ERRORS = new Set(['CDP_HTTP_FAILED', 'CDP_RENDERER_NOT_FOUND', 'CDP_CONNECTION_FAILED']);

const HELP = `Awesome Codex Themes

Usage:
  awesome-codex-themes list
  awesome-codex-themes doctor
  awesome-codex-themes start <theme>
  awesome-codex-themes apply <theme> --port <port>
  awesome-codex-themes status
  awesome-codex-themes restore [--port <port>]

The engine only connects to CDP on 127.0.0.1 and never terminates the official app.`;

export class CliError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'CliError';
    this.code = code;
  }
}

function cliFail(code, message) {
  throw new CliError(code, message);
}

function parsePort(value) {
  if (!/^\d+$/.test(value ?? '')) cliFail('CLI_PORT_INVALID', 'Port must be an integer between 1024 and 65535.');
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
    cliFail('CLI_PORT_INVALID', 'Port must be an integer between 1024 and 65535.');
  }
  return port;
}

function requireTheme(args) {
  const theme = args[0];
  if (!theme || theme.startsWith('-')) cliFail('CLI_THEME_REQUIRED', 'Choose a theme slug, for example: obsidian-bloom.');
  return theme;
}

function rejectExtraArgs(args, expected, command) {
  if (args.length !== expected) cliFail('CLI_ARGUMENT_INVALID', `Invalid arguments for ${command}. Run help for usage.`);
}

function errorCode(error) {
  return typeof error?.code === 'string' && error.code ? error.code : 'UNEXPECTED_ERROR';
}

export async function runCli(argv, dependencies, io = { out: console.log, error: console.error }) {
  const [command = 'help', ...args] = argv;
  try {
    if (command === 'help' || command === '--help' || command === '-h') {
      rejectExtraArgs(args, 0, 'help');
      io.out(HELP);
      return 0;
    }

    if (command === 'list') {
      rejectExtraArgs(args, 0, 'list');
      const themes = await dependencies.listThemes();
      if (themes.length === 0) {
        io.out('No installed themes were found.');
        return 0;
      }
      for (const theme of themes) {
        io.out(`${theme.slug}  ${theme.status}  ${theme.categories.join(', ')}  ${theme.name}`);
      }
      return 0;
    }

    if (command === 'doctor') {
      rejectExtraArgs(args, 0, 'doctor');
      const report = await dependencies.doctor();
      io.out(`app: ${report.appPath}`);
      io.out(`version: ${report.version}`);
      io.out(`running: ${report.runningPids.length ? report.runningPids.join(', ') : 'no'}`);
      return 0;
    }

    if (command === 'start') {
      const theme = requireTheme(args);
      rejectExtraArgs(args, 1, 'start');
      const result = await dependencies.start(theme);
      io.out(`started ${result.theme} on 127.0.0.1:${result.port}`);
      return 0;
    }

    if (command === 'apply') {
      const theme = requireTheme(args);
      if (args[1] !== '--port' || args.length !== 3) {
        cliFail('CLI_PORT_REQUIRED', 'apply requires an explicit local CDP port: --port <port>.');
      }
      const result = await dependencies.apply(theme, parsePort(args[2]));
      io.out(`applied ${result.theme} to ${result.renderers} renderer${result.renderers === 1 ? '' : 's'}`);
      return 0;
    }

    if (command === 'status') {
      rejectExtraArgs(args, 0, 'status');
      const result = await dependencies.status();
      if (result.stale) {
        io.out(`inactive — stale state for ${result.theme}; run restore to clean project-owned state`);
      } else if (!result.active) {
        io.out('inactive — official UI is not managed by Awesome Codex Themes');
      } else {
        io.out(`active — ${result.theme} on 127.0.0.1:${result.port}`);
      }
      return 0;
    }

    if (command === 'restore') {
      let port;
      if (args.length > 0) {
        if (args[0] !== '--port' || args.length !== 2) {
          cliFail('CLI_ARGUMENT_INVALID', 'restore accepts only an optional explicit local CDP port.');
        }
        port = parsePort(args[1]);
      }
      const result = await dependencies.restore(port);
      io.out(`restored official UI${result.theme ? ` from ${result.theme}` : ''}`);
      return 0;
    }

    if (command === '_watch') {
      const theme = requireTheme(args);
      if (args[1] !== '--port' || args[3] !== '--app-pid' || args.length !== 5) {
        cliFail('CLI_ARGUMENT_INVALID', 'Internal watcher arguments are invalid.');
      }
      await dependencies.watch(theme, parsePort(args[2]), Number(args[4]));
      return 0;
    }

    cliFail('CLI_COMMAND_UNKNOWN', `Unknown command: ${command}. Run help for usage.`);
  } catch (error) {
    io.error(`[${errorCode(error)}] ${error?.message ?? 'Unexpected failure.'}`);
    return 1;
  }
}

function portIsAvailable(port) {
  return new Promise((resolveAvailable) => {
    const server = createServer();
    server.once('error', () => resolveAvailable(false));
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
      server.close(() => resolveAvailable(true));
    });
  });
}

async function waitForRenderer(port, { attempts = 80, delayMs = 250 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await evaluateOnRendererTargets({ port, expression: '({ pass: true })' });
      return;
    } catch (error) {
      if (!RETRYABLE_CDP_ERRORS.has(error?.code) || attempt === attempts - 1) throw error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
    }
  }
}

async function observeInjector(pid, expected) {
  try {
    const [startedAt, command] = await Promise.all([
      processStartedAt(pid),
      execFileAsync('/bin/ps', ['-ww', '-p', String(pid), '-o', 'command='], { encoding: 'utf8' }),
    ]);
    const commandLine = command.stdout.trim();
    const trustedPrefix = `${expected.injectorExecutable} ${expected.injectorScript}`;
    if (commandLine !== trustedPrefix && !commandLine.startsWith(`${trustedPrefix} `)) {
      return { pid, startedAt, executable: '', script: '' };
    }
    return {
      pid,
      startedAt,
      executable: expected.injectorExecutable,
      script: expected.injectorScript,
    };
  } catch {
    return null;
  }
}

function launchOfficialApp(app, port) {
  const child = spawn(
    app.executable,
    [`--remote-debugging-address=127.0.0.1`, `--remote-debugging-port=${port}`],
    { detached: true, stdio: 'ignore' },
  );
  child.unref();
  return child;
}

function spawnWatcher({ themeSlug, port, appPid, app }) {
  const child = spawn(
    app.nodePath,
    [cliPath, '_watch', themeSlug, '--port', String(port), '--app-pid', String(appPid)],
    { detached: true, stdio: 'ignore' },
  );
  child.unref();
  return { pid: child.pid, executable: app.nodePath, script: cliPath };
}

function processExists(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function terminateProcess(
  pid,
  {
    signal = (processId, name) => process.kill(processId, name),
    exists = processExists,
    delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds)),
    attempts = 40,
  } = {},
) {
  if (!Number.isInteger(pid) || pid < 1) cliFail('CLI_PID_INVALID', 'Watcher PID must be a positive integer.');
  signal(pid, 'SIGTERM');
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (!exists(pid)) return;
    await delay(50);
  }
  cliFail('INJECTOR_STOP_TIMEOUT', `Watcher ${pid} did not exit after SIGTERM; live theme removal was not claimed.`);
}

export function createDefaultDependencies() {
  return {
    async listThemes() {
      const entries = await readdir(themesRoot, { withFileTypes: true });
      const themes = await Promise.all(
        entries
          .filter((entry) => entry.isDirectory())
          .map(async (entry) => (await loadThemePackage(join(themesRoot, entry.name))).manifest),
      );
      return themes
        .map((manifest) => ({
          slug: manifest.slug,
          name: manifest.name,
          categories: manifest.categories,
          status: manifest.compatibility.status,
        }))
        .sort((left, right) => left.slug.localeCompare(right.slug));
    },

    async doctor() {
      const app = await discoverOfficialApp();
      return {
        appPath: app.appPath,
        version: app.version,
        runningPids: await listOfficialAppPids(app),
      };
    },

    async start(themeSlug) {
      return startThemeSession(
        { themeSlug, statePath },
        {
          discoverApp: discoverOfficialApp,
          listPids: listOfficialAppPids,
          selectPort: () => findAvailablePort({ start: 9_341, end: 9_441, isAvailable: portIsAvailable }),
          launchApp: launchOfficialApp,
          processStartedAt,
          waitForRenderer,
          applyTheme: async ({ themeSlug: slug, port, app }) => {
            await assertOfficialPortOwner(app, port);
            return applyThemeAtPort({
              themesRoot,
              themeSlug: slug,
              port,
              appVersion: app.version,
            });
          },
          spawnWatcher,
          writeState: writeRuntimeState,
          removeTheme: async (port, app) => {
            await assertOfficialPortOwner(app, port);
            return removeThemeAtPort({ port });
          },
          stopWatcher: terminateProcess,
        },
      );
    },

    async apply(themeSlug, port) {
      const app = await discoverOfficialApp();
      await assertOfficialPortOwner(app, port);
      return applyThemeAtPort({ themesRoot, themeSlug, port, appVersion: app.version });
    },

    async status() {
      try {
        const state = await readRuntimeState(statePath);
        try {
          const app = await discoverOfficialApp();
          const [appPids, appStartedAt, injector] = await Promise.all([
            listOfficialAppPids(app),
            processStartedAt(state.appPid),
            observeInjector(state.injectorPid, state),
          ]);
          const active =
            app.appPath === state.appPath &&
            app.version === state.appVersion &&
            appPids.includes(state.appPid) &&
            appStartedAt === state.appStartedAt &&
            matchesProcessIdentity(state, injector);
          return active
            ? { active: true, theme: state.themeSlug, port: state.port }
            : { active: false, stale: true, theme: state.themeSlug, port: state.port };
        } catch {
          return { active: false, stale: true, theme: state.themeSlug, port: state.port };
        }
      } catch (error) {
        if (error?.code === 'STATE_READ_FAILED' && error?.cause?.code === 'ENOENT') return { active: false };
        throw error;
      }
    },

    async restore(port) {
      if (port !== undefined) {
        const app = await discoverOfficialApp();
        await assertOfficialPortOwner(app, port);
        return removeThemeAtPort({ port });
      }
      let expected;
      return restoreThemeSession(
        { statePath },
        {
          readState: async (path) => {
            expected = await readRuntimeState(path);
            return expected;
          },
          observeInjector: (pid) => observeInjector(pid, expected),
          removeTheme: async (port) => {
            try {
              await removeThemeAtPort({ port });
            } catch (error) {
              if (!RETRYABLE_CDP_ERRORS.has(error?.code)) throw error;
            }
          },
          killInjector: terminateProcess,
          removeState: (path) => rm(path, { force: true }),
        },
      );
    },

    async watch(themeSlug, port, appPid) {
      if (!Number.isInteger(appPid) || appPid < 1) cliFail('CLI_PID_INVALID', 'Internal watcher PID is invalid.');
      const app = await discoverOfficialApp();
      let stopping = false;
      process.once('SIGTERM', () => {
        stopping = true;
      });
      process.once('SIGINT', () => {
        stopping = true;
      });

      while (!stopping && processExists(appPid)) {
        try {
          await assertOfficialPortOwner(app, port);
          await applyThemeAtPort({ themesRoot, themeSlug, port, appVersion: app.version });
        } catch (error) {
          if (!RETRYABLE_CDP_ERRORS.has(error?.code)) throw error;
        }
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_500));
      }
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === cliPath) {
  const exitCode = await runCli(process.argv.slice(2), createDefaultDependencies());
  process.exitCode = exitCode;
}
