import { access, chmod, cp, mkdir, readdir, rename, rm, symlink } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

import { writeAgentConfig } from './config.mjs';
import {
  bootoutLaunchAgent,
  bootstrapLaunchAgent,
  buildLaunchAgentPlist,
  kickstartLaunchAgent,
  writeLaunchAgentPlist,
} from './launch-agent.mjs';
import { loadThemePackage } from './theme.mjs';

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export class InstallerError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'InstallerError';
    this.code = code;
  }
}

function fail(code, message, options) {
  throw new InstallerError(code, message, options);
}

function requireAbsolute(value, field) {
  if (typeof value !== 'string' || !isAbsolute(value)) fail('INSTALL_PATH_INVALID', `${field} must be an absolute path.`);
  return value;
}

export function installationPaths({ home, version }) {
  const userHome = requireAbsolute(home, 'home');
  if (typeof version !== 'string' || !VERSION_PATTERN.test(version)) {
    fail('INSTALL_VERSION_INVALID', 'version must use semantic versioning.');
  }
  const supportRoot = join(userHome, 'Library/Application Support/AwesomeCodexThemes');
  const releasesRoot = join(supportRoot, 'releases');
  const releaseDir = join(releasesRoot, version);
  const currentPath = join(supportRoot, 'current');
  return {
    supportRoot,
    releasesRoot,
    releaseDir,
    currentPath,
    configPath: join(supportRoot, 'config.json'),
    agentStatePath: join(supportRoot, 'agent-state.json'),
    plistPath: join(userHome, 'Library/LaunchAgents/io.github.awesome-codex-themes.agent.plist'),
    stdoutPath: join(userHome, 'Library/Logs/AwesomeCodexThemes.log'),
    stderrPath: join(userHome, 'Library/Logs/AwesomeCodexThemes.error.log'),
  };
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function validateRunnableThemes(sourceRoot, selectedTheme) {
  const themesRoot = join(sourceRoot, 'themes');
  const entries = await readdir(themesRoot, { withFileTypes: true });
  const slugs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  if (!slugs.includes(selectedTheme)) fail('INSTALL_THEME_NOT_FOUND', `Theme ${selectedTheme} is not a runnable package.`);
  await Promise.all(slugs.map((slug) => loadThemePackage(join(themesRoot, slug))));
  return slugs;
}

export async function installPersistentAgent(
  { sourceRoot, home, version, themeSlug, enabled = true },
  {
    copy = (source, destination) => cp(source, destination, { recursive: true, force: true }),
    bootout = bootoutLaunchAgent,
    bootstrap = bootstrapLaunchAgent,
    kickstart = kickstartLaunchAgent,
    writeConfig = writeAgentConfig,
    writePlist = writeLaunchAgentPlist,
  } = {},
) {
  const source = requireAbsolute(sourceRoot, 'sourceRoot');
  const paths = installationPaths({ home, version });
  await validateRunnableThemes(source, themeSlug);
  await mkdir(paths.releasesRoot, { recursive: true, mode: 0o700 });

  if (!(await exists(paths.releaseDir))) {
    const staging = `${paths.releaseDir}.staging-${process.pid}-${Date.now()}`;
    await mkdir(staging, { recursive: true, mode: 0o700 });
    try {
      await copy(join(source, 'package.json'), join(staging, 'package.json'));
      await copy(join(source, 'bin'), join(staging, 'bin'));
      await copy(join(source, 'src/cli'), join(staging, 'src/cli'));
      await copy(join(source, 'src/engine'), join(staging, 'src/engine'));
      await copy(join(source, 'themes'), join(staging, 'themes'));
      await chmod(join(staging, 'bin/awesome-codex-themes'), 0o755);
      await rename(staging, paths.releaseDir);
    } catch (error) {
      await rm(staging, { recursive: true, force: true }).catch(() => {});
      fail('INSTALL_COPY_FAILED', 'Unable to stage the self-contained runtime.', { cause: error });
    }
  }

  await writeConfig(paths.configPath, {
    schemaVersion: 1,
    enabled,
    themeSlug,
    launchAtLogin: true,
  });

  const plist = buildLaunchAgentPlist({
    launcherPath: join(paths.currentPath, 'bin/awesome-codex-themes'),
    stdoutPath: paths.stdoutPath,
    stderrPath: paths.stderrPath,
  });
  await writePlist(paths.plistPath, plist);

  const temporaryLink = `${paths.currentPath}.next-${process.pid}-${Date.now()}`;
  try {
    await symlink(paths.releaseDir, temporaryLink, 'dir');
    await rename(temporaryLink, paths.currentPath);
  } catch (error) {
    await rm(temporaryLink, { force: true }).catch(() => {});
    fail('INSTALL_ACTIVATE_FAILED', 'Unable to activate the installed runtime.', { cause: error });
  }

  await bootout({ ignoreMissing: true });
  await bootstrap(paths.plistPath);
  await kickstart();
  return { installed: true, theme: themeSlug, version, supportRoot: paths.supportRoot, plistPath: paths.plistPath };
}

export async function uninstallPersistentAgent(
  { home },
  { bootout = bootoutLaunchAgent, remove = rm } = {},
) {
  const paths = installationPaths({ home, version: '0.0.0' });
  await bootout({ ignoreMissing: true });
  await remove(paths.plistPath, { force: true });
  await remove(paths.supportRoot, { recursive: true, force: true });
  return { uninstalled: true };
}
