import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '../..');

async function text(path) {
  return readFile(join(repoRoot, path), 'utf8');
}

describe('public English-first documentation', () => {
  test('documents the persistent Satoru Gojo lifecycle without internal iteration labels', async () => {
    const readme = await text('README.md');

    for (const command of [
      'install-agent satoru-gojo --takeover-at-login',
      'upgrade-agent',
      'switch satoru-gojo',
      'pause',
      'resume',
      'uninstall-agent',
    ]) {
      expect(readme, command).toContain(command);
    }
    expect(readme).toContain('Satoru Gojo');
    expect(readme).toContain('五条 悟');
    expect(readme).toContain('Twelve full-workspace visual themes');
    expect(readme).toContain('Satoru Gojo (五条 悟) — Featured');
    expect(readme).toContain('New World Studio');
    expect(readme).toContain('Best-effort injection is attempted on every numeric Codex Desktop version');
    expect(readme).toContain('Highly compatible and live-verified: `26.707.*` and `26.715.*`');
    expect(readme).toContain('GitHub Issue');
    expect(readme).not.toContain('hard version allowlist');
    expect(readme).not.toMatch(/limitless-six-eyes|Limitless Six Eyes|\bV5(?:\.6)?\b|private flagship/i);
  });

  test('ships install, migration, and authoring recovery documentation', async () => {
    const [install, migration, authoring, releasing] = await Promise.all([
      text('docs/INSTALL.md'),
      text('docs/MIGRATION.md'),
      text('docs/THEME_AUTHORING.md'),
      text('docs/RELEASING.md'),
    ]);

    expect(install).toContain('install-agent satoru-gojo --takeover-at-login');
    expect(install).toContain('120-second startup window');
    expect(install).toContain('restart-required');
    expect(install).toContain('launchctl bootout');
    expect(migration).toContain('legacy injector');
    expect(migration).toContain('doctor');
    expect(authoring).toContain('English primary name');
    expect(authoring).toContain('nativeName');
    expect(releasing).toContain('Public visibility gate');
    expect(releasing).toContain('pnpm check');
    expect(releasing).toContain('macOS lifecycle evidence');
    expect(releasing).toContain('v0.4.4');
  });

  test('publishes only complete runnable theme previews', async () => {
    const themeDirectories = (await readdir(join(repoRoot, 'themes'), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const publicDirectories = (await readdir(join(repoRoot, 'public/theme-assets'), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    const expected = [
      'castle-archive',
      'foundling-garden',
      'grand-line',
      'mordor-runtime',
      'new-world-studio',
      'night-city',
      'overworld-realms',
      'saiyan-ukiyoe',
      'satoru-gojo',
      'slingshot-lab',
      'symbiote-sumi-e',
      'zaun-workshop',
    ];
    expect(themeDirectories).toEqual(expected);
    expect(publicDirectories).toEqual(expected);
  });

  test('uses a rights declaration instead of a categorical character-theme ban', async () => {
    const [contributing, submission, notice] = await Promise.all([
      text('CONTRIBUTING.md'),
      text('.github/ISSUE_TEMPLATE/theme_submission.yml'),
      text('NOTICE'),
    ]);
    const combined = `${contributing}\n${submission}\n${notice}`;

    expect(combined).toContain('necessary rights');
    expect(combined).not.toContain('no unlicensed character, celebrity, game, anime, logo, or brand artwork');
    expect(notice).toContain('All twelve');
    expect(notice).not.toMatch(/private prototype|must be replaced|Limitless Six Eyes/i);
  });

  test('bumps the platform for the persistent-agent release line', async () => {
    const packageJson = JSON.parse(await text('package.json'));
    expect(packageJson.version).toBe('0.4.4');
  });
});
