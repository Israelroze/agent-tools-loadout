import * as vscode from 'vscode';
import type { SourceResolver } from '../services/sourceResolver';
import type { RepoManager } from '../services/repoManager';
import type { ContentScanner } from '../services/contentScanner';
import type { LoadoutTreeProvider } from '../ui/loadoutTreeProvider';
import { getEffectiveSources } from '../services/orgPolicy';
import * as logger from '../utils/logger';

/**
 * Refresh: re-resolve sources, re-sync repos, rescan content.
 */
export async function refreshCommand(
  sourceResolver: SourceResolver,
  repoManager: RepoManager,
  contentScanner: ContentScanner,
  treeProvider: LoadoutTreeProvider
): Promise<void> {
  treeProvider.setLoading(true);

  try {
    // Read current sources from settings, merged with org policy preloaded sources
    const sources = getEffectiveSources();

    if (sources.length === 0) {
      treeProvider.update(sources, [], {
        items: new Map(),
        errors: new Map(),
      });
      return;
    }

    // Resolve all sources into concrete repo URLs
    const resolvedRepos = await sourceResolver.resolveAllSources(sources);
    logger.info(`Resolved ${resolvedRepos.length} repos from ${sources.length} sources`);

    // Sync all repos in parallel
    await repoManager.initialize();
    const syncResults = await repoManager.syncAllRepos(resolvedRepos);

    // Determine which repos changed and which failed
    const changedRepos = new Set<string>();
    const failedRepos = new Map<string, string>();
    for (const [sourceId, result] of syncResults) {
      if (result.error) {
        failedRepos.set(sourceId, result.error);
      } else if (result.changed) {
        changedRepos.add(sourceId);
      }
    }

    // Warn about failed repos
    if (failedRepos.size > 0) {
      const failedNames = Array.from(failedRepos.keys()).map(
        (id) => resolvedRepos.find((r) => r.sourceId === id)?.displayName ?? id
      );
      logger.warn(`Failed to sync ${failedRepos.size} repos: ${failedNames.join(', ')}`);
      for (const [sourceId, error] of failedRepos) {
        logger.error(`  ${sourceId}: ${error}`);
      }
      vscode.window.showWarningMessage(
        `Agent Tools Loadout: Failed to clone ${failedRepos.size} repo(s): ${failedNames.join(', ')}`
      );
    }

    // Only scan repos that synced successfully
    const syncedRepos = resolvedRepos.filter((r) => !failedRepos.has(r.sourceId));

    // Scan all repos (worker thread handles heavy lifting)
    contentScanner.clearCache();
    const scanResults = await contentScanner.scanRepos(
      syncedRepos,
      repoManager,
      changedRepos
    );

    // Update the tree view — pass all resolvedRepos so failed ones still show (with error)
    // Add clone errors to scan errors
    for (const [sourceId, error] of failedRepos) {
      scanResults.errors.set(sourceId, `Clone failed: ${error}`);
    }
    treeProvider.update(sources, resolvedRepos, scanResults);

    const totalItems =
      Array.from(scanResults.items.values()).reduce((sum, items) => sum + items.length, 0);

    const syncedCount = resolvedRepos.length - failedRepos.size;
    vscode.window.showInformationMessage(
      `Agent Tools Loadout: Loaded ${totalItems} items from ${syncedCount} repos`
    );
  } catch (err) {
    logger.error(`Refresh failed: ${err}`);
    treeProvider.setLoading(false);
    vscode.window.showErrorMessage(`Agent Tools Loadout: Refresh failed — ${err}`);
  }
}
