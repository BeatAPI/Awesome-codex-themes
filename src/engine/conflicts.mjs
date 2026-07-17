import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export function detectInjectorConflicts({ launchAgents = [], processCommands = [] }) {
  const conflicts = [];
  for (const agent of launchAgents) {
    const evidence = `${agent.path}\n${agent.content}`;
    if (/com\.kkkk\.codex-nocturne|codex-nocturne\/theme_agent\.py/i.test(evidence)) {
      conflicts.push({
        id: 'legacy-nocturne-launch-agent',
        path: agent.path,
        recovery: 'Boot out the legacy agent only after restoring its owned theme state.',
      });
    }
  }

  if (
    processCommands.some(
      (command) =>
        /\/(?:ChatGPT|Codex)(?:\.app)?\//i.test(command) &&
        /--remote-allow-origins=\*/.test(command),
    )
  ) {
    conflicts.push({
      id: 'wildcard-cdp-origin',
      recovery: 'Relaunch through the audited loopback-only launcher after explicit user approval.',
    });
  }
  return conflicts;
}

export async function inspectInjectorConflicts(
  home,
  {
    readDirectory = readdir,
    readText = (path) => readFile(path, 'utf8'),
    listCommands = async () => (await execFileAsync('/bin/ps', ['-axo', 'command='], { encoding: 'utf8' })).stdout.split('\n'),
  } = {},
) {
  const directory = join(home, 'Library/LaunchAgents');
  let entries = [];
  try {
    entries = await readDirectory(directory, { withFileTypes: true });
  } catch {
    entries = [];
  }
  const launchAgents = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.plist')) continue;
    const path = join(directory, entry.name);
    try {
      launchAgents.push({ path, content: await readText(path) });
    } catch {
      // Unreadable unrelated agents are outside this project's ownership.
    }
  }
  return detectInjectorConflicts({ launchAgents, processCommands: await listCommands() });
}
