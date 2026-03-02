import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import type { ContentType, ResolvedRepo } from './types';
import { SourceResolver } from './services/sourceResolver';
import { RepoManager } from './services/repoManager';
import { ContentScanner } from './services/contentScanner';
import { EquipmentService } from './services/equipmentService';
import { LoadoutTreeProvider } from './ui/loadoutTreeProvider';
import type { ContentTreeItem } from './ui/loadoutTreeItems';
import { refreshCommand } from './commands/refreshCommand';
import { equipCommand } from './commands/equipCommand';
import { convertCommand } from './commands/convertCommand';
import { previewCommand } from './commands/previewCommand';
import { addSourceCommand } from './commands/addSourceCommand';
import { removeSourceCommand } from './commands/removeSourceCommand';
import { unequipCommand } from './commands/unequipCommand';
import { COMMANDS, VIEW_IDS } from './utils/constants';
import { getEffectiveSources } from './services/orgPolicy';
import { setGitPath } from './utils/git';
import * as logger from './utils/logger';

let resolvedRepos: ResolvedRepo[] = [];

export function activate(context: vscode.ExtensionContext): void {
  logger.info('Agent Tools Loadout extension activating...');

  // Initialize services
  const globalStoragePath = context.globalStorageUri.fsPath;
  const workerPath = path.join(context.extensionPath, 'dist', 'scanWorker.js');

  const sourceResolver = new SourceResolver();
  const repoManager = new RepoManager(globalStoragePath);
  const contentScanner = new ContentScanner(workerPath);
  contentScanner.setGitPath(resolveGitBinary());
  const equipmentService = new EquipmentService(context);
  const treeProvider = new LoadoutTreeProvider();

  // Sync tree with initial equipped map, pruning any files deleted since last session
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const initialSyncPromise = workspaceRoot
    ? equipmentService.pruneEquippedMap(workspaceRoot).then(() => {
        treeProvider.setEquippedMap(equipmentService.getEquippedMap());
      })
    : Promise.resolve();
  initialSyncPromise.then(() => {
    treeProvider.setEquippedMap(equipmentService.getEquippedMap());
  });

  // Register tree view with checkbox support
  const treeView = vscode.window.createTreeView(VIEW_IDS.BROWSER, {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
    manageCheckboxStateManually: true,
  });

  // Handle checkbox changes
  treeView.onDidChangeCheckboxState((event) => {
    treeProvider.handleCheckboxChange(event);
  });

  // Register commands
  context.subscriptions.push(
    treeView,

    vscode.commands.registerCommand(COMMANDS.REFRESH, () =>
      refreshCommand(sourceResolver, repoManager, contentScanner, treeProvider).then(
        async () => {
          // Update resolvedRepos after refresh
          const sources = getEffectiveSources();
          sourceResolver.resolveAllSources(sources).then((repos) => {
            resolvedRepos = repos;
          });
          // Prune equipped map — remove entries for files deleted from workspace
          const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
          if (root) {
            await equipmentService.pruneEquippedMap(root);
          }
          treeProvider.setEquippedMap(equipmentService.getEquippedMap());
        }
      )
    ),

    vscode.commands.registerCommand(COMMANDS.EQUIP, async (item?: ContentTreeItem) => {
      await equipCommand(item, treeProvider, resolvedRepos, contentScanner, repoManager, equipmentService);
      treeProvider.setEquippedMap(equipmentService.getEquippedMap());
    }),

    vscode.commands.registerCommand(COMMANDS.EQUIP_SELECTED, async () => {
      await equipCommand(undefined, treeProvider, resolvedRepos, contentScanner, repoManager, equipmentService);
      treeProvider.setEquippedMap(equipmentService.getEquippedMap());
    }),

    vscode.commands.registerCommand(COMMANDS.CONVERT, () =>
      convertCommand(equipmentService)
    ),

    vscode.commands.registerCommand(COMMANDS.PREVIEW, (item: ContentTreeItem) =>
      previewCommand(item, resolvedRepos, contentScanner, repoManager)
    ),

    vscode.commands.registerCommand(COMMANDS.ADD_SOURCE, () => addSourceCommand()),

    vscode.commands.registerCommand(COMMANDS.REMOVE_SOURCE, () =>
      removeSourceCommand(resolvedRepos, repoManager)
    ),

    vscode.commands.registerCommand(COMMANDS.SEARCH, async () => {
      const value = await vscode.window.showInputBox({
        prompt: 'Search content across all repos',
        placeHolder: 'e.g. react typescript, clean code, nextjs...',
        value: treeProvider.activeFilter,
      });
      if (value !== undefined) {
        treeProvider.setFilter(value);
        treeView.description = value ? `Search: ${value}` : undefined;
        vscode.commands.executeCommand('setContext', 'agentLoadout.searchActive', !!value);
      }
    }),

    vscode.commands.registerCommand(COMMANDS.CLEAR_SEARCH, () => {
      treeProvider.clearFilter();
      treeView.description = undefined;
      vscode.commands.executeCommand('setContext', 'agentLoadout.searchActive', false);
    }),

    vscode.commands.registerCommand(COMMANDS.FILTER_TYPE, async () => {
      const typeLabels: { label: string; type: ContentType }[] = [
        { label: '$(book) Instructions', type: 'instructions' },
        { label: '$(wand) Skills', type: 'skill' },
        { label: '$(person) Sub-agents', type: 'subagent' },
      ];
      const picked = await vscode.window.showQuickPick(typeLabels, {
        placeHolder: 'Filter by content type',
      });
      if (picked) {
        treeProvider.setTypeFilter(picked.type);
        vscode.commands.executeCommand('setContext', 'agentLoadout.typeFilterActive', true);
      }
    }),

    vscode.commands.registerCommand(COMMANDS.CLEAR_TYPE_FILTER, () => {
      treeProvider.setTypeFilter(null);
      vscode.commands.executeCommand('setContext', 'agentLoadout.typeFilterActive', false);
    }),

    vscode.commands.registerCommand(COMMANDS.UNEQUIP, () => unequipCommand()),

    vscode.commands.registerCommand(COMMANDS.PURGE_CACHE, async () => {
      await repoManager.purgeAll();
      contentScanner.clearCache();
      vscode.window.showInformationMessage('Agent Tools Loadout: Cache purged. Click refresh to re-clone.');
      vscode.commands.executeCommand(COMMANDS.REFRESH);
    }),

    vscode.commands.registerCommand(COMMANDS.SET_SENSITIVITY, async () => {
      const current = vscode.workspace
        .getConfiguration()
        .get<string>('agentLoadout.sensitivity', 'medium');
      const picked = await vscode.window.showQuickPick(
        [
          { label: 'Low', description: 'Show almost all files with matching extensions', value: 'low' },
          { label: 'Medium', description: 'Require structural signal (directory, frontmatter, or filename)', value: 'medium' },
          { label: 'High', description: 'Require strong signals (frontmatter type + content heuristics)', value: 'high' },
        ].map((item) => ({ ...item, picked: item.value === current })),
        { placeHolder: 'Select content filtering sensitivity' }
      );
      if (!picked) return;
      await vscode.workspace
        .getConfiguration()
        .update('agentLoadout.sensitivity', picked.value, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`Agent Tools Loadout: Sensitivity set to "${picked.label}".`);
    }),

    // Re-init when settings change
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('agentLoadout')) {
        vscode.commands.executeCommand(COMMANDS.REFRESH);
      }
    })
  );

  // Auto-refresh on activation if sources are configured (includes org policy preloaded sources)
  const sources = getEffectiveSources();
  if (sources.length > 0) {
    vscode.commands.executeCommand(COMMANDS.REFRESH);
  }

  logger.info('Agent Tools Loadout extension activated.');
}

export function deactivate(): void {
  // Worker thread cleanup happens via ContentScanner.dispose()
}

/**
 * Resolve the git binary path from VS Code's built-in git extension.
 * This is the most reliable way since VS Code already knows where git is.
 */
function resolveGitBinary(): string {
  try {
    const gitExtension = vscode.extensions.getExtension('vscode.git');
    if (gitExtension?.isActive) {
      const git = gitExtension.exports.getAPI(1);
      const gitPath = git?.git?.path;
      if (gitPath) {
        setGitPath(gitPath);
        logger.info(`Using git binary: ${gitPath}`);
        return gitPath;
      }
    }
  } catch {
    // Fall through to manual search
  }

  // Fallback: try common locations
  const candidates = [
    '/usr/bin/git',
    '/usr/local/bin/git',
    '/opt/homebrew/bin/git',
  ];
  for (const candidate of candidates) {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      setGitPath(candidate);
      logger.info(`Using git binary (fallback): ${candidate}`);
      return candidate;
    } catch {
      // Try next
    }
  }
  logger.warn('Could not resolve git binary path, using "git" from PATH');
  return 'git';
}
