import { execFile } from 'node:child_process';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, test } from 'vitest';

const execFileAsync = promisify(execFile);
const repoRoot = resolve(import.meta.dirname, '../..');
const tempDirs = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('installed CLI entry', () => {
  test('runs when invoked through the installed current symlink', async () => {
    const home = await mkdtemp(join(tmpdir(), 'awesome-codex-entry-'));
    tempDirs.push(home);
    const current = join(home, 'current');
    await symlink(repoRoot, current, 'dir');

    const { stdout } = await execFileAsync(process.execPath, [join(current, 'src/cli/main.mjs'), 'help'], {
      encoding: 'utf8',
    });

    expect(stdout).toContain('Awesome Codex Themes');
    expect(stdout).toContain('install-agent <theme>');
  });
});
