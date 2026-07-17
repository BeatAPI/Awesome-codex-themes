import { describe, expect, test, vi } from 'vitest';

import { pausePersistentInstallation } from '../../src/engine/control.mjs';

describe('persistent lifecycle control', () => {
  test('disables persistence before requesting live owned-style removal', async () => {
    const events = [];
    const writeConfig = vi.fn(async (_path, config) => events.push(['write', config.enabled]));
    const kickstart = vi.fn(async () => events.push(['kickstart']));
    const removeTheme = vi.fn(async ({ port }) => events.push(['remove', port]));

    const result = await pausePersistentInstallation(
      { configPath: '/support/config.json', statePath: '/support/agent-state.json' },
      {
        readConfig: async () => ({ schemaVersion: 1, enabled: true, themeSlug: 'satoru-gojo', launchAtLogin: true }),
        writeConfig,
        readState: async () => ({ themeSlug: 'satoru-gojo', port: 9341 }),
        kickstart,
        removeTheme,
      },
    );

    expect(events).toEqual([['write', false], ['kickstart'], ['remove', 9341]]);
    expect(result).toEqual({ paused: true, theme: 'satoru-gojo', liveRemoval: 'removed' });
  });

  test('still pauses safely when no observed state or reachable endpoint exists', async () => {
    const removeTheme = vi.fn();

    await expect(
      pausePersistentInstallation(
        { configPath: '/support/config.json', statePath: '/support/agent-state.json' },
        {
          readConfig: async () => ({ schemaVersion: 1, enabled: true, themeSlug: 'satoru-gojo', launchAtLogin: true }),
          writeConfig: async () => {},
          readState: async () => {
            throw Object.assign(new Error('missing'), { code: 'AGENT_STATE_READ_FAILED' });
          },
          kickstart: async () => {},
          removeTheme,
        },
      ),
    ).resolves.toEqual({ paused: true, theme: 'satoru-gojo', liveRemoval: 'not-reachable' });
    expect(removeTheme).not.toHaveBeenCalled();
  });
});
