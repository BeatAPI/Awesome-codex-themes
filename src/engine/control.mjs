import { readAgentState } from './agent-state.mjs';
import { readAgentConfig, writeAgentConfig } from './config.mjs';
import { kickstartLaunchAgent } from './launch-agent.mjs';

export async function pausePersistentInstallation(
  { configPath, statePath },
  {
    readConfig = readAgentConfig,
    writeConfig = writeAgentConfig,
    readState = readAgentState,
    kickstart = kickstartLaunchAgent,
    removeTheme,
  } = {},
) {
  const config = await readConfig(configPath);
  await writeConfig(configPath, { ...config, enabled: false });

  let state = null;
  try {
    state = await readState(statePath);
  } catch (error) {
    if (error?.code !== 'AGENT_STATE_READ_FAILED') throw error;
  }

  await kickstart();

  let liveRemoval = 'not-reachable';
  if (state?.port !== null && state?.port !== undefined && typeof removeTheme === 'function') {
    try {
      await removeTheme({ port: state.port, state });
      liveRemoval = 'removed';
    } catch {
      // Persistence is already disabled. Never broaden process control just to
      // turn an unreachable cleanup request into a success claim.
    }
  }

  return { paused: true, theme: config.themeSlug, liveRemoval };
}
