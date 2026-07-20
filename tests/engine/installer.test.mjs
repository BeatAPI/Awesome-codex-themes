import { access, lstat, mkdtemp, readFile, readlink, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  installPersistentAgent,
  installationPaths,
  uninstallPersistentAgent,
} from '../../src/engine/installer.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');
const tempDirs = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('self-contained persistent installation', () => {
  test('copies the audited runtime and runnable themes outside the Git clone', async () => {
    const home = await mkdtemp(join(tmpdir(), 'awesome-codex-install-'));
    tempDirs.push(home);
    const bootstrap = vi.fn(async () => {});
    const kickstart = vi.fn(async () => {});
    const bootout = vi.fn(async () => {});

    const result = await installPersistentAgent(
      {
        sourceRoot: repoRoot,
        home,
        version: '0.3.0',
        themeSlug: 'satoru-gojo',
        takeoverAtLogin: true,
      },
      { bootout, bootstrap, kickstart },
    );
    const paths = installationPaths({ home, version: '0.3.0' });

    expect(result).toEqual(expect.objectContaining({ installed: true, theme: 'satoru-gojo' }));
    await expect(access(join(paths.releaseDir, 'bin/awesome-codex-themes'))).resolves.toBeUndefined();
    await expect(access(join(paths.releaseDir, 'src/cli/main.mjs'))).resolves.toBeUndefined();
    await expect(access(join(paths.releaseDir, 'src/engine/cdp.mjs'))).resolves.toBeUndefined();
    await expect(access(join(paths.releaseDir, 'themes/satoru-gojo/theme.json'))).resolves.toBeUndefined();
    expect((await stat(join(paths.releaseDir, 'bin/awesome-codex-themes'))).mode & 0o111).not.toBe(0);
    expect((await lstat(paths.currentPath)).isSymbolicLink()).toBe(true);
    expect(await readlink(paths.currentPath)).toBe(paths.releaseDir);

    const config = JSON.parse(await readFile(paths.configPath, 'utf8'));
    expect(config).toEqual({
      schemaVersion: 1,
      enabled: true,
      themeSlug: 'satoru-gojo',
      launchAtLogin: true,
      takeoverAtLogin: true,
      startupTakeoverWindowSeconds: 120,
    });
    expect((await stat(paths.configPath)).mode & 0o777).toBe(0o600);
    expect(await readFile(paths.plistPath, 'utf8')).toContain(join(paths.currentPath, 'bin/awesome-codex-themes'));
    expect(bootout).toHaveBeenCalledWith({ ignoreMissing: true });
    expect(bootstrap).toHaveBeenCalledWith(paths.plistPath);
    expect(kickstart).toHaveBeenCalledOnce();
  });

  test('is idempotent for the same release and refreshes desired configuration', async () => {
    const home = await mkdtemp(join(tmpdir(), 'awesome-codex-install-'));
    tempDirs.push(home);
    const dependencies = {
      bootout: vi.fn(async () => {}),
      bootstrap: vi.fn(async () => {}),
      kickstart: vi.fn(async () => {}),
    };

    await installPersistentAgent({ sourceRoot: repoRoot, home, version: '0.3.0', themeSlug: 'satoru-gojo' }, dependencies);
    await expect(
      installPersistentAgent({
        sourceRoot: repoRoot,
        home,
        version: '0.3.0',
        themeSlug: 'satoru-gojo',
        enabled: false,
      }, dependencies),
    ).resolves.toEqual(expect.objectContaining({ installed: true }));

    const paths = installationPaths({ home, version: '0.3.0' });
    expect((await readdir(paths.releasesRoot)).filter((name) => name.includes('staging'))).toEqual([]);
    expect(dependencies.bootout).toHaveBeenCalledTimes(2);
    expect(dependencies.bootstrap).toHaveBeenCalledTimes(2);
    expect(dependencies.kickstart).toHaveBeenCalledTimes(2);
    expect(JSON.parse(await readFile(paths.configPath, 'utf8')).enabled).toBe(false);
  });

  test('cleans a staging release when copying fails', async () => {
    const home = await mkdtemp(join(tmpdir(), 'awesome-codex-install-'));
    tempDirs.push(home);
    const copy = vi.fn(async () => {
      throw new Error('disk full');
    });

    await expect(
      installPersistentAgent(
        { sourceRoot: repoRoot, home, version: '0.3.0', themeSlug: 'satoru-gojo' },
        { copy, bootstrap: vi.fn(), kickstart: vi.fn() },
      ),
    ).rejects.toEqual(expect.objectContaining({ code: 'INSTALL_COPY_FAILED' }));

    const paths = installationPaths({ home, version: '0.3.0' });
    expect((await readdir(paths.releasesRoot)).filter((name) => name.includes('staging'))).toEqual([]);
  });

  test('boots out and removes only project-owned installation paths', async () => {
    const home = await mkdtemp(join(tmpdir(), 'awesome-codex-install-'));
    tempDirs.push(home);
    const dependencies = {
      bootout: vi.fn(async () => {}),
      bootstrap: vi.fn(async () => {}),
      kickstart: vi.fn(async () => {}),
    };
    await installPersistentAgent({ sourceRoot: repoRoot, home, version: '0.3.0', themeSlug: 'satoru-gojo' }, dependencies);
    const bootout = vi.fn(async () => {});

    await uninstallPersistentAgent({ home }, { bootout });

    const paths = installationPaths({ home, version: '0.3.0' });
    expect(bootout).toHaveBeenCalledWith({ ignoreMissing: true });
    await expect(access(paths.supportRoot)).rejects.toThrow();
    await expect(access(paths.plistPath)).rejects.toThrow();
  });
});
