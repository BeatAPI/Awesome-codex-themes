export class CdpError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'CdpError';
    this.code = code;
  }
}

function cdpFail(code, message, options) {
  throw new CdpError(code, message, options);
}

export function assertLoopbackUrl(value, allowedProtocols) {
  let url;
  try {
    url = new URL(value);
  } catch (error) {
    cdpFail('CDP_ENDPOINT_UNSAFE', 'CDP endpoint is not a valid URL.', { cause: error });
  }

  if (!Array.isArray(allowedProtocols) || !allowedProtocols.includes(url.protocol) || url.hostname !== '127.0.0.1') {
    cdpFail('CDP_ENDPOINT_UNSAFE', 'CDP endpoints must use an allowed protocol on 127.0.0.1.');
  }
  return url;
}

function isMainRendererUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'app:' && url.hostname === '-' && url.pathname === '/index.html' && !url.searchParams.has('initialRoute');
  } catch {
    return false;
  }
}

export function selectRendererTargets(targets, expectedPort) {
  if (!Array.isArray(targets)) {
    cdpFail('CDP_RESPONSE_INVALID', 'CDP target list must be an array.');
  }

  const selected = [];
  for (const target of targets) {
    if (
      target?.type !== 'page' ||
      !['Codex', 'ChatGPT'].includes(target.title) ||
      !isMainRendererUrl(target.url)
    ) {
      continue;
    }
    const websocket = assertLoopbackUrl(target.webSocketDebuggerUrl, ['ws:']);
    if (Number(websocket.port) !== Number(expectedPort)) continue;
    selected.push({ ...target, webSocketDebuggerUrl: websocket.toString() });
  }
  return selected;
}

export async function findAvailablePort({ start, end, isAvailable }) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1024 || end < start || typeof isAvailable !== 'function') {
    cdpFail('CDP_PORT_RANGE_INVALID', 'A valid non-privileged port range is required.');
  }
  for (let port = start; port <= end; port += 1) {
    if (await isAvailable(port)) return port;
  }
  cdpFail('CDP_PORT_UNAVAILABLE', `No available loopback port between ${start} and ${end}.`);
}

export class JsonCdpClient {
  #socket;
  #timeoutMs;
  #nextId = 1;
  #pending = new Map();
  #onMessage;

  constructor(socket, { timeoutMs = 5_000 } = {}) {
    if (!socket || typeof socket.send !== 'function' || typeof socket.addEventListener !== 'function') {
      throw new TypeError('A WebSocket-compatible transport is required.');
    }
    this.#socket = socket;
    this.#timeoutMs = timeoutMs;
    this.#onMessage = (event) => this.#handleMessage(event);
    socket.addEventListener('message', this.#onMessage);
  }

  #handleMessage(event) {
    let message;
    try {
      message = JSON.parse(String(event.data));
    } catch {
      return;
    }
    if (!Number.isInteger(message.id) || !this.#pending.has(message.id)) return;

    const pending = this.#pending.get(message.id);
    this.#pending.delete(message.id);
    clearTimeout(pending.timer);
    if (message.error) {
      pending.reject(
        new CdpError(
          'CDP_PROTOCOL_ERROR',
          `CDP command failed (${message.error.code ?? 'unknown'}): ${message.error.message ?? 'Unknown error'}`,
        ),
      );
      return;
    }
    pending.resolve(message.result ?? {});
  }

  send(method, params = {}) {
    if (typeof method !== 'string' || method.trim() === '') {
      return Promise.reject(new CdpError('CDP_COMMAND_INVALID', 'CDP method is required.'));
    }
    const id = this.#nextId;
    this.#nextId += 1;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new CdpError('CDP_COMMAND_TIMEOUT', `CDP command timed out: ${method}`));
      }, this.#timeoutMs);
      this.#pending.set(id, { resolve, reject, timer });
      this.#socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.#socket.removeEventListener?.('message', this.#onMessage);
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new CdpError('CDP_CONNECTION_CLOSED', 'CDP connection closed.'));
    }
    this.#pending.clear();
    this.#socket.close?.();
  }
}

async function defaultEvaluateTarget(target, expression, { WebSocketImpl = globalThis.WebSocket, timeoutMs = 5_000 } = {}) {
  if (typeof WebSocketImpl !== 'function') {
    cdpFail('CDP_WEBSOCKET_UNAVAILABLE', 'The selected Node runtime does not provide WebSocket support.');
  }
  assertLoopbackUrl(target.webSocketDebuggerUrl, ['ws:']);
  const socket = new WebSocketImpl(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new CdpError('CDP_CONNECTION_TIMEOUT', 'Timed out connecting to the Codex renderer.')),
      timeoutMs,
    );
    socket.addEventListener(
      'open',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    socket.addEventListener(
      'error',
      () => {
        clearTimeout(timer);
        reject(new CdpError('CDP_CONNECTION_FAILED', 'Unable to connect to the Codex renderer.'));
      },
      { once: true },
    );
  });

  const client = new JsonCdpClient(socket, { timeoutMs });
  try {
    await client.send('Runtime.enable');
    const result = await client.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    return result?.result?.value;
  } finally {
    client.close();
  }
}

export async function evaluateOnRendererTargets({
  port,
  expression,
  fetchImpl = globalThis.fetch,
  evaluateTarget = defaultEvaluateTarget,
}) {
  if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
    cdpFail('CDP_PORT_INVALID', 'A valid non-privileged CDP port is required.');
  }
  if (typeof expression !== 'string' || expression.trim() === '') {
    cdpFail('CDP_COMMAND_INVALID', 'A runtime expression is required.');
  }

  const endpoint = `http://127.0.0.1:${port}/json/list`;
  assertLoopbackUrl(endpoint, ['http:']);
  let response;
  let targets;
  try {
    response = await fetchImpl(endpoint);
    if (!response?.ok) cdpFail('CDP_HTTP_FAILED', 'CDP target discovery returned a non-success response.');
    targets = await response.json();
  } catch (error) {
    if (error instanceof CdpError) throw error;
    cdpFail('CDP_HTTP_FAILED', 'Unable to query the local CDP endpoint.', { cause: error });
  }

  const renderers = selectRendererTargets(targets, port);
  if (renderers.length === 0) {
    cdpFail('CDP_RENDERER_NOT_FOUND', 'No supported Codex main renderer was found.');
  }
  return Promise.all(renderers.map((target) => evaluateTarget(target, expression)));
}
