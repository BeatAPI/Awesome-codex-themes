import { EventEmitter } from 'node:events';
import { describe, expect, test, vi } from 'vitest';

import {
  CdpError,
  JsonCdpClient,
  assertLoopbackUrl,
  evaluateOnRendererTargets,
  findAvailablePort,
  selectRendererTargets,
} from '../../src/engine/cdp.mjs';

class FakeSocket extends EventEmitter {
  sent = [];

  addEventListener(event, listener) {
    this.on(event, listener);
  }

  removeEventListener(event, listener) {
    this.off(event, listener);
  }

  send(value) {
    this.sent.push(JSON.parse(value));
  }

  emitMessage(value) {
    this.emit('message', { data: JSON.stringify(value) });
  }
}

describe('assertLoopbackUrl', () => {
  test.each([
    ['http://127.0.0.1:9341/json/list', ['http:']],
    ['ws://127.0.0.1:9341/devtools/page/abc', ['ws:']],
  ])('accepts an explicit 127.0.0.1 URL', (value, protocols) => {
    expect(assertLoopbackUrl(value, protocols).hostname).toBe('127.0.0.1');
  });

  test.each([
    'http://localhost:9341/json/list',
    'http://0.0.0.0:9341/json/list',
    'ws://192.168.1.10:9341/devtools/page/abc',
    'wss://example.com/devtools/page/abc',
    'not a url',
  ])('rejects non-literal or non-loopback endpoints', (value) => {
    expect(() => assertLoopbackUrl(value, ['http:', 'ws:'])).toThrowError(
      expect.objectContaining({ code: 'CDP_ENDPOINT_UNSAFE' }),
    );
  });
});

describe('selectRendererTargets', () => {
  test('keeps only the official main app renderer on the expected port', () => {
    const targets = [
      {
        id: 'main',
        type: 'page',
        title: 'Codex',
        url: 'app://-/index.html',
        webSocketDebuggerUrl: 'ws://127.0.0.1:9341/devtools/page/main',
      },
      {
        id: 'overlay',
        type: 'page',
        title: 'Codex',
        url: 'app://-/index.html?initialRoute=%2Fhotkey-window',
        webSocketDebuggerUrl: 'ws://127.0.0.1:9341/devtools/page/overlay',
      },
      {
        id: 'web',
        type: 'page',
        title: 'GitHub',
        url: 'https://github.com',
        webSocketDebuggerUrl: 'ws://127.0.0.1:9341/devtools/page/web',
      },
      {
        id: 'wrong-port',
        type: 'page',
        title: 'Codex',
        url: 'app://-/index.html',
        webSocketDebuggerUrl: 'ws://127.0.0.1:9999/devtools/page/wrong',
      },
    ];

    expect(selectRendererTargets(targets, 9341).map((target) => target.id)).toEqual(['main']);
  });

  test('throws when a candidate claims an unsafe WebSocket endpoint', () => {
    const targets = [
      {
        id: 'unsafe',
        type: 'page',
        title: 'Codex',
        url: 'app://-/index.html',
        webSocketDebuggerUrl: 'ws://example.com/devtools/page/unsafe',
      },
    ];

    expect(() => selectRendererTargets(targets, 9341)).toThrowError(
      expect.objectContaining({ code: 'CDP_ENDPOINT_UNSAFE' }),
    );
  });
});

describe('findAvailablePort', () => {
  test('returns the first available port in the configured range', async () => {
    const isAvailable = vi.fn(async (port) => port === 9343);

    await expect(findAvailablePort({ start: 9341, end: 9344, isAvailable })).resolves.toBe(9343);
    expect(isAvailable).toHaveBeenCalledTimes(3);
  });

  test('fails with a stable code when the range is exhausted', async () => {
    await expect(
      findAvailablePort({ start: 9341, end: 9342, isAvailable: async () => false }),
    ).rejects.toEqual(expect.objectContaining({ code: 'CDP_PORT_UNAVAILABLE' }));
  });
});

describe('JsonCdpClient', () => {
  test('matches responses to monotonic command ids', async () => {
    const socket = new FakeSocket();
    const client = new JsonCdpClient(socket, { timeoutMs: 100 });

    const pending = client.send('Runtime.evaluate', { expression: '1 + 1' });
    expect(socket.sent[0]).toEqual({ id: 1, method: 'Runtime.evaluate', params: { expression: '1 + 1' } });
    socket.emitMessage({ id: 1, result: { result: { value: 2 } } });

    await expect(pending).resolves.toEqual({ result: { value: 2 } });
    client.close();
  });

  test('rejects commands that exceed the timeout', async () => {
    vi.useFakeTimers();
    const socket = new FakeSocket();
    const client = new JsonCdpClient(socket, { timeoutMs: 50 });
    const pending = client.send('Runtime.evaluate');
    const rejection = expect(pending).rejects.toEqual(
      expect.objectContaining({ code: 'CDP_COMMAND_TIMEOUT' }),
    );

    await vi.advanceTimersByTimeAsync(51);

    await rejection;
    client.close();
    vi.useRealTimers();
  });

  test('surfaces protocol errors without raw socket data', async () => {
    const socket = new FakeSocket();
    const client = new JsonCdpClient(socket, { timeoutMs: 100 });
    const pending = client.send('Runtime.evaluate');
    socket.emitMessage({ id: 1, error: { code: -32000, message: 'Evaluation failed' } });

    await expect(pending).rejects.toBeInstanceOf(CdpError);
    client.close();
  });
});

describe('evaluateOnRendererTargets', () => {
  test('fetches the local target list and evaluates only matching renderers', async () => {
    const target = {
      id: 'main',
      type: 'page',
      title: 'Codex',
      url: 'app://-/index.html',
      webSocketDebuggerUrl: 'ws://127.0.0.1:9341/devtools/page/main',
    };
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => [target],
    }));
    const evaluateTarget = vi.fn(async (_target, expression) => ({ expression, pass: true }));

    const results = await evaluateOnRendererTargets({
      port: 9341,
      expression: 'document.title',
      fetchImpl,
      evaluateTarget,
    });

    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:9341/json/list');
    expect(evaluateTarget).toHaveBeenCalledWith(expect.objectContaining({ id: 'main' }), 'document.title');
    expect(results).toEqual([{ expression: 'document.title', pass: true }]);
  });

  test('fails when no main renderer is available', async () => {
    await expect(
      evaluateOnRendererTargets({
        port: 9341,
        expression: '1',
        fetchImpl: async () => ({ ok: true, json: async () => [] }),
        evaluateTarget: vi.fn(),
      }),
    ).rejects.toEqual(expect.objectContaining({ code: 'CDP_RENDERER_NOT_FOUND' }));
  });
});
