import { describe, expect, test, vi } from 'vitest';

import { CliError, runCli, terminateProcess } from '../../src/cli/main.mjs';

function createIo() {
  const stdout = [];
  const stderr = [];
  return {
    stdout,
    stderr,
    io: {
      out: (value) => stdout.push(value),
      error: (value) => stderr.push(value),
    },
  };
}

function dependencies(overrides = {}) {
  return {
    listThemes: async () => [],
    doctor: async () => ({ appPath: '/Applications/ChatGPT.app', version: '26.707.72221', runningPids: [] }),
    start: async () => ({ theme: 'obsidian-bloom', port: 9341 }),
    apply: async () => ({ theme: 'obsidian-bloom', renderers: 1 }),
    status: async () => ({ active: false }),
    restore: async () => ({ restored: true, theme: 'obsidian-bloom' }),
    watch: async () => {},
    ...overrides,
  };
}

describe('runCli', () => {
  test('prints a stable global help surface', async () => {
    const { io, stdout } = createIo();

    await expect(runCli(['help'], dependencies(), io)).resolves.toBe(0);
    expect(stdout.join('\n')).toContain('start <theme>');
    expect(stdout.join('\n')).toContain('restore');
    expect(stdout.join('\n')).not.toContain('_watch');
  });

  test('lists themes with category and compatibility metadata', async () => {
    const { io, stdout } = createIo();
    const deps = dependencies({
      listThemes: async () => [
        { slug: 'obsidian-bloom', name: 'Obsidian Bloom', categories: ['dark', 'organic'], status: 'verified' },
      ],
    });

    await expect(runCli(['list'], deps, io)).resolves.toBe(0);
    expect(stdout.join('\n')).toContain('obsidian-bloom');
    expect(stdout.join('\n')).toContain('dark, organic');
    expect(stdout.join('\n')).toContain('verified');
  });

  test('reports doctor evidence without changing application state', async () => {
    const { io, stdout } = createIo();
    const doctor = vi.fn(dependencies().doctor);

    await expect(runCli(['doctor'], dependencies({ doctor }), io)).resolves.toBe(0);
    expect(doctor).toHaveBeenCalledOnce();
    expect(stdout.join('\n')).toContain('/Applications/ChatGPT.app');
    expect(stdout.join('\n')).toContain('26.707.72221');
  });

  test('requires an explicit theme for start and apply', async () => {
    const { io, stderr } = createIo();

    await expect(runCli(['start'], dependencies(), io)).resolves.toBe(1);
    expect(stderr.join('\n')).toContain('[CLI_THEME_REQUIRED]');
  });

  test('passes a validated explicit port to apply', async () => {
    const { io, stdout } = createIo();
    const apply = vi.fn(dependencies().apply);

    await expect(runCli(['apply', 'obsidian-bloom', '--port', '9341'], dependencies({ apply }), io)).resolves.toBe(0);
    expect(apply).toHaveBeenCalledWith('obsidian-bloom', 9341);
    expect(stdout.join('\n')).toContain('1 renderer');
  });

  test('prints stable error codes and preserves the original recovery message', async () => {
    const { io, stderr } = createIo();
    const start = vi.fn(async () => {
      throw new CliError('APP_ALREADY_RUNNING', 'Quit Codex explicitly; no process was terminated.');
    });

    await expect(runCli(['start', 'obsidian-bloom'], dependencies({ start }), io)).resolves.toBe(1);
    expect(stderr).toEqual(['[APP_ALREADY_RUNNING] Quit Codex explicitly; no process was terminated.']);
  });

  test('reports inactive status as a successful diagnostic result', async () => {
    const { io, stdout } = createIo();

    await expect(runCli(['status'], dependencies(), io)).resolves.toBe(0);
    expect(stdout).toEqual(['inactive — official UI is not managed by Awesome Codex Themes']);
  });

  test('does not call a stale state file active', async () => {
    const { io, stdout } = createIo();

    await expect(
      runCli(['status'], dependencies({ status: async () => ({ active: false, stale: true, theme: 'arctic-signal' }) }), io),
    ).resolves.toBe(0);
    expect(stdout.join('\n')).toContain('stale state');
    expect(stdout.join('\n')).toContain('run restore');
  });

  test('runs restore without accepting a theme argument', async () => {
    const { io, stdout } = createIo();
    const restore = vi.fn(dependencies().restore);

    await expect(runCli(['restore'], dependencies({ restore }), io)).resolves.toBe(0);
    expect(restore).toHaveBeenCalledOnce();
    expect(stdout.join('\n')).toContain('restored official UI');
  });

  test('restores a one-shot apply using the same validated explicit port', async () => {
    const { io, stdout } = createIo();
    const restore = vi.fn(dependencies().restore);

    await expect(runCli(['restore', '--port', '9341'], dependencies({ restore }), io)).resolves.toBe(0);
    expect(restore).toHaveBeenCalledWith(9341);
    expect(stdout.join('\n')).toContain('restored official UI');
  });
});

describe('terminateProcess', () => {
  test('signals the watcher and waits until that exact PID has exited', async () => {
    const signal = vi.fn();
    const exists = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
    const delay = vi.fn(async () => {});

    await expect(terminateProcess(456, { signal, exists, delay, attempts: 3 })).resolves.toBeUndefined();
    expect(signal).toHaveBeenCalledWith(456, 'SIGTERM');
    expect(delay).toHaveBeenCalledOnce();
  });

  test('fails instead of claiming restore while the watcher remains alive', async () => {
    await expect(
      terminateProcess(456, {
        signal: vi.fn(),
        exists: () => true,
        delay: async () => {},
        attempts: 2,
      }),
    ).rejects.toEqual(expect.objectContaining({ code: 'INJECTOR_STOP_TIMEOUT' }));
  });
});
