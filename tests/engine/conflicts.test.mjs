import { describe, expect, test } from 'vitest';

import { detectInjectorConflicts } from '../../src/engine/conflicts.mjs';

describe('theme injector conflict diagnostics', () => {
  test('reports the known legacy Nocturne agent and wildcard CDP launch without mutating them', () => {
    const conflicts = detectInjectorConflicts({
      launchAgents: [
        {
          path: '/Users/test/Library/LaunchAgents/com.kkkk.codex-nocturne.plist',
          content: '<string>/Users/test/.local/share/codex-nocturne/theme_agent.py</string>',
        },
      ],
      processCommands: [
        '/Applications/ChatGPT.app/Contents/MacOS/ChatGPT --remote-debugging-address=127.0.0.1 --remote-allow-origins=*',
      ],
    });

    expect(conflicts).toEqual([
      expect.objectContaining({ id: 'legacy-nocturne-launch-agent', path: expect.stringContaining('com.kkkk.codex-nocturne.plist') }),
      expect.objectContaining({ id: 'wildcard-cdp-origin' }),
    ]);
  });

  test('does not report the project-owned agent or a loopback-only managed launch', () => {
    expect(
      detectInjectorConflicts({
        launchAgents: [
          {
            path: '/Users/test/Library/LaunchAgents/io.github.awesome-codex-themes.agent.plist',
            content: '<string>io.github.awesome-codex-themes.agent</string>',
          },
        ],
        processCommands: [
          '/Applications/ChatGPT.app/Contents/MacOS/ChatGPT --remote-debugging-address=127.0.0.1 --remote-debugging-port=9341',
        ],
      }),
    ).toEqual([]);
  });
});
