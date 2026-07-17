import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const launcherPath = resolve(import.meta.dirname, '../../bin/awesome-codex-themes');

describe('shell launcher trust boundary', () => {
  test('verifies the official bundle before executing its bundled Node runtime', async () => {
    const launcher = await readFile(launcherPath, 'utf8');
    const identityCheck = launcher.indexOf('CFBundleIdentifier');
    const signatureCheck = launcher.indexOf('/usr/bin/codesign --verify --deep --strict');
    const teamCheck = launcher.indexOf('TeamIdentifier');
    const nodeExecution = launcher.indexOf('exec "$NODE_PATH"');

    expect(identityCheck).toBeGreaterThan(0);
    expect(signatureCheck).toBeGreaterThan(identityCheck);
    expect(teamCheck).toBeGreaterThan(signatureCheck);
    expect(nodeExecution).toBeGreaterThan(teamCheck);
    expect(launcher).toContain('com.openai.codex');
    expect(launcher).toContain('2DC432GLL2');
    expect(launcher).not.toMatch(/\beval\b|--remote-allow-origins=\*/);
  });
});
