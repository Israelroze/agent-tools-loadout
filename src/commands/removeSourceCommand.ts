import * as vscode from 'vscode';
import type { SourceConfig, ResolvedRepo } from '../types';
import type { RepoManager } from '../services/repoManager';
import { CONFIG_KEYS, COMMANDS } from '../utils/constants';
import { isPreloadedSource } from '../services/orgPolicy';

export async function removeSourceCommand(
  resolvedRepos: ResolvedRepo[],
  repoManager: RepoManager
): Promise<void> {
  const sources = vscode.workspace
    .getConfiguration()
    .get<SourceConfig[]>(CONFIG_KEYS.SOURCES, []);

  // Only show user-added sources (preloaded org sources cannot be removed)
  const removableSources = sources.filter((s) => !isPreloadedSource(s));

  if (removableSources.length === 0) {
    vscode.window.showInformationMessage(
      sources.length > 0
        ? 'Agent Tools Loadout: No removable sources. Organization sources cannot be removed.'
        : 'Agent Tools Loadout: No sources configured.'
    );
    return;
  }

  const items = removableSources.map((s) => ({
    label: s.name ?? s.url,
    description: `Repository${s.path ? ` → ${s.path}` : ''}`,
    source: s,
  }));

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select source to remove',
  });
  if (!picked) return;

  const removedSource = picked.source;

  // Remove cached repo for this source
  const repo = resolvedRepos.find((r) => r.sourceId === `repo:${removedSource.url}`);
  if (repo) {
    await repoManager.removeRepo(repo);
  }

  // Remove from settings — find by URL to avoid index drift
  const updatedSources = sources.filter(
    (s) => s.url.trim().toLowerCase() !== removedSource.url.trim().toLowerCase()
  );
  const config = vscode.workspace.getConfiguration();
  await config.update(CONFIG_KEYS.SOURCES, updatedSources, vscode.ConfigurationTarget.Global);

  vscode.window.showInformationMessage(`Agent Tools Loadout: Removed "${picked.label}".`);

  // Auto-refresh the tree
  vscode.commands.executeCommand(COMMANDS.REFRESH);
}
