import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '../..');

async function collectTextFiles(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = join(path, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTextFiles(entryPath)));
    } else if (/\.(?:css|html|json|md|mjs|ts|tsx|yml)$/.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

describe('public release preflight', () => {
  test('has one command that runs the complete portable release gate', async () => {
    const packageJson = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8'));
    const workflow = await readFile(join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
    const readme = await readFile(join(repoRoot, 'README.md'), 'utf8');

    expect(packageJson.scripts['release:check']).toBe(
      'pnpm check && pnpm audit --prod --audit-level moderate && git diff --check',
    );
    expect(workflow).toContain('run: pnpm release:check');
    expect(readme).toContain('pnpm release:check');
  });

  test('contains no maintainer home path or internal V5.6 label in public release files', async () => {
    const roots = [
      '.github',
      'docs',
      'src',
      'themes',
    ];
    const rootFiles = [
      'CHANGELOG.md',
      'CONTRIBUTING.md',
      'NOTICE',
      'README.md',
      'SECURITY.md',
      'index.html',
      'package.json',
    ];
    const nestedFiles = (await Promise.all(roots.map((root) => collectTextFiles(join(repoRoot, root))))).flat();
    const files = [...rootFiles.map((file) => join(repoRoot, file)), ...nestedFiles];

    for (const file of files) {
      const source = await readFile(file, 'utf8');
      expect(source, file).not.toMatch(/\/Users\/kkkk\//);
      expect(source, file).not.toMatch(/\bv\s*5\.6\b/i);
    }
  });

  test('does not present the private 0.2 prototype as a published release', async () => {
    const changelog = await readFile(join(repoRoot, 'CHANGELOG.md'), 'utf8');

    expect(changelog).toContain('Private prototype history (not publicly released)');
    expect(changelog).not.toContain('/releases/tag/v0.2.0');
  });
});
