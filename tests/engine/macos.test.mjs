import { describe, expect, test, vi } from 'vitest';

import {
  EXPECTED_BUNDLE_ID,
  EXPECTED_TEAM_ID,
  MacRuntimeError,
  assertOfficialPortOwner,
  discoverOfficialApp,
  inspectOfficialApp,
  listOfficialAppPids,
  validateMacAppInspection,
} from '../../src/engine/macos.mjs';

function validInspection(overrides = {}) {
  return {
    appPath: '/Applications/ChatGPT.app',
    executable: '/Applications/ChatGPT.app/Contents/MacOS/ChatGPT',
    nodePath: '/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node',
    bundleId: EXPECTED_BUNDLE_ID,
    version: '26.707.72221',
    teamId: EXPECTED_TEAM_ID,
    signatureValid: true,
    nodeVersion: '22.16.0',
    nodeArch: 'arm64',
    hostArch: 'arm64',
    ...overrides,
  };
}

describe('validateMacAppInspection', () => {
  test('accepts the signed official app and bundled runtime', () => {
    expect(validateMacAppInspection(validInspection()).version).toBe('26.707.72221');
  });

  test.each([
    [{ bundleId: 'com.example.fake' }, 'APP_IDENTITY_INVALID'],
    [{ teamId: 'BADTEAM' }, 'APP_SIGNATURE_INVALID'],
    [{ signatureValid: false }, 'APP_SIGNATURE_INVALID'],
    [{ nodeVersion: '18.20.0' }, 'APP_RUNTIME_UNSUPPORTED'],
    [{ nodeArch: 'x64' }, 'APP_ARCH_MISMATCH'],
  ])('fails closed for invalid application identity', (overrides, code) => {
    expect(() => validateMacAppInspection(validInspection(overrides))).toThrowError(
      expect.objectContaining({ code }),
    );
  });
});

describe('inspectOfficialApp', () => {
  test('uses argv-based system tools and validates the result', async () => {
    const accessImpl = vi.fn(async () => {});
    const runCommand = vi.fn(async (command, args) => {
      const joined = `${command} ${args.join(' ')}`;
      if (joined.includes('CFBundleIdentifier')) return { stdout: `${EXPECTED_BUNDLE_ID}\n`, stderr: '' };
      if (joined.includes('CFBundleShortVersionString')) return { stdout: '26.707.72221\n', stderr: '' };
      if (joined.includes('CFBundleExecutable')) return { stdout: 'ChatGPT\n', stderr: '' };
      if (command === '/usr/bin/codesign' && args.includes('--verify')) return { stdout: '', stderr: '' };
      if (command === '/usr/bin/codesign') return { stdout: '', stderr: `Identifier=${EXPECTED_BUNDLE_ID}\nTeamIdentifier=${EXPECTED_TEAM_ID}\n` };
      if (args[0] === '--version') return { stdout: 'v22.16.0\n', stderr: '' };
      if (args[0] === '-p') return { stdout: 'arm64\n', stderr: '' };
      throw new Error(`Unexpected command: ${joined}`);
    });

    const result = await inspectOfficialApp('/Applications/ChatGPT.app', {
      accessImpl,
      runCommand,
      hostArch: 'arm64',
    });

    expect(result).toEqual(validInspection());
    expect(runCommand).toHaveBeenCalledWith('/usr/bin/codesign', ['--verify', '--deep', '--strict', '/Applications/ChatGPT.app']);
  });
});

describe('discoverOfficialApp', () => {
  test('returns the first valid candidate and records no untrusted fallback', async () => {
    const inspect = vi
      .fn()
      .mockRejectedValueOnce(new MacRuntimeError('APP_NOT_FOUND', 'missing'))
      .mockResolvedValueOnce(validInspection());

    await expect(
      discoverOfficialApp({ candidates: ['/Applications/Codex.app', '/Applications/ChatGPT.app'], inspect }),
    ).resolves.toEqual(validInspection());
    expect(inspect).toHaveBeenCalledTimes(2);
  });

  test('fails when no candidate passes inspection', async () => {
    await expect(
      discoverOfficialApp({
        candidates: ['/tmp/Fake.app'],
        inspect: async () => {
          throw new Error('no');
        },
      }),
    ).rejects.toEqual(expect.objectContaining({ code: 'APP_NOT_FOUND' }));
  });
});

describe('listOfficialAppPids', () => {
  test('matches only the exact inspected executable', async () => {
    const runCommand = vi.fn(async () => ({
      stdout: [
        ' 101 /Applications/ChatGPT.app/Contents/MacOS/ChatGPT --remote-debugging-port=9341',
        ' 202 /tmp/ChatGPT --fake',
        ' 303 /Applications/ChatGPT.app/Contents/MacOS/ChatGPT-helper',
      ].join('\n'),
      stderr: '',
    }));

    await expect(listOfficialAppPids(validInspection(), { runCommand })).resolves.toEqual([101]);
  });
});

describe('assertOfficialPortOwner', () => {
  test('accepts only a loopback listener owned by the inspected official app process', async () => {
    const runCommand = vi.fn(async () => ({ stdout: 'p101\nn127.0.0.1:9341\n', stderr: '' }));

    await expect(
      assertOfficialPortOwner(validInspection(), 9341, {
        listPids: async () => [101],
        runCommand,
      }),
    ).resolves.toEqual({ port: 9341, ownerPids: [101] });
    expect(runCommand).toHaveBeenCalledWith('/usr/sbin/lsof', [
      '-nP', '-iTCP:9341', '-sTCP:LISTEN', '-F', 'pn',
    ]);
  });

  test.each([
    ['p202\nn127.0.0.1:9341\n', 'CDP_PORT_OWNER_INVALID'],
    ['p101\nn*:9341\n', 'CDP_LISTENER_UNSAFE'],
    ['p101\nn[::1]:9341\n', 'CDP_LISTENER_UNSAFE'],
  ])('rejects an untrusted owner or non-literal listener address', async (stdout, code) => {
    await expect(
      assertOfficialPortOwner(validInspection(), 9341, {
        listPids: async () => [101],
        runCommand: async () => ({ stdout, stderr: '' }),
      }),
    ).rejects.toEqual(expect.objectContaining({ code }));
  });
});
