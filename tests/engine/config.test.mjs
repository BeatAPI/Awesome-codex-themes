import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

import {
  AgentConfigError,
  readAgentConfig,
  validateAgentConfig,
  writeAgentConfig,
} from '../../src/engine/config.mjs';

const tempDirs = [];

function validConfig(overrides = {}) {
  return {
    schemaVersion: 1,
    enabled: true,
    themeSlug: 'satoru-gojo',
    launchAtLogin: true,
    takeoverAtLogin: true,
    startupTakeoverWindowSeconds: 120,
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('agent configuration', () => {
  test('normalizes a complete English-slug desired configuration', () => {
    expect(validateAgentConfig(validConfig())).toEqual(validConfig());
  });

  test('keeps legacy schema-1 configurations safe by default', () => {
    expect(validateAgentConfig({
      schemaVersion: 1,
      enabled: true,
      themeSlug: 'satoru-gojo',
      launchAtLogin: true,
    })).toEqual({
      schemaVersion: 1,
      enabled: true,
      themeSlug: 'satoru-gojo',
      launchAtLogin: true,
      takeoverAtLogin: false,
      startupTakeoverWindowSeconds: 120,
    });
  });

  test.each([
    [{ schemaVersion: 2 }, 'CONFIG_SCHEMA_INVALID'],
    [{ enabled: 'yes' }, 'CONFIG_FIELD_INVALID'],
    [{ launchAtLogin: 'yes' }, 'CONFIG_FIELD_INVALID'],
    [{ takeoverAtLogin: 'yes' }, 'CONFIG_FIELD_INVALID'],
    [{ takeoverAtLogin: true, launchAtLogin: false }, 'CONFIG_FIELD_INVALID'],
    [{ startupTakeoverWindowSeconds: 0 }, 'CONFIG_FIELD_INVALID'],
    [{ startupTakeoverWindowSeconds: 301 }, 'CONFIG_FIELD_INVALID'],
    [{ themeSlug: '../escape' }, 'CONFIG_THEME_INVALID'],
  ])('rejects malformed desired configuration', (overrides, code) => {
    expect(() => validateAgentConfig(validConfig(overrides))).toThrowError(expect.objectContaining({ code }));
  });

  test('writes atomically with owner-only permissions and reads it back', async () => {
    const root = await mkdtemp(join(tmpdir(), 'awesome-codex-config-'));
    tempDirs.push(root);
    const path = join(root, 'nested/config.json');

    await writeAgentConfig(path, validConfig());

    expect(await readAgentConfig(path)).toEqual(validConfig());
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect(JSON.parse(await readFile(path, 'utf8')).schemaVersion).toBe(1);
  });

  test('uses a typed error for malformed JSON', async () => {
    const root = await mkdtemp(join(tmpdir(), 'awesome-codex-config-'));
    tempDirs.push(root);
    const path = join(root, 'config.json');
    await import('node:fs/promises').then(({ writeFile }) => writeFile(path, '{bad'));

    await expect(readAgentConfig(path)).rejects.toBeInstanceOf(AgentConfigError);
  });
});
