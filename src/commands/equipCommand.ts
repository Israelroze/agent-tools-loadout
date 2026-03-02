import * as vscode from 'vscode';
import type { AgentId, ContentSummary, ContentType, ResolvedRepo } from '../types';
import type { ContentScanner } from '../services/contentScanner';
import type { RepoManager } from '../services/repoManager';
import type { EquipmentService } from '../services/equipmentService';
import type { LoadoutTreeProvider } from '../ui/loadoutTreeProvider';
import type { ContentTreeItem } from '../ui/loadoutTreeItems';
import { AGENT_CONFIGS, CONFIG_KEYS } from '../utils/constants';
import * as logger from '../utils/logger';

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  instructions: 'instructions',
  skill: 'skills',
  subagent: 'sub-agents',
};

/**
 * Equip a single item (from context menu) or all checked items (from title bar).
 */
export async function equipCommand(
  item: ContentTreeItem | undefined,
  treeProvider: LoadoutTreeProvider,
  resolvedRepos: ResolvedRepo[],
  contentScanner: ContentScanner,
  repoManager: RepoManager,
  equipmentService: EquipmentService
): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('Agent Tools Loadout: No workspace folder open.');
    return;
  }

  // Determine which items to equip
  let summaries: ContentSummary[];
  if (item) {
    summaries = [item.summary];
  } else {
    summaries = treeProvider.getCheckedItems();
    if (summaries.length === 0) {
      vscode.window.showWarningMessage('Agent Tools Loadout: No items selected. Check items in the tree first to load.');
      return;
    }
  }

  // Pick target agent
  const agentId = await pickAgent();
  if (!agentId) return;

  // Check content type compatibility
  const config = AGENT_CONFIGS[agentId];
  const unsupported = summaries.filter(
    (s) => !config.supportedContentTypes.includes(s.metadata.contentType)
  );

  if (unsupported.length > 0) {
    const types = [...new Set(unsupported.map((s) => CONTENT_TYPE_LABELS[s.metadata.contentType]))];
    const names = unsupported.map((s) => s.metadata.name);
    const namesList = names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
    vscode.window.showErrorMessage(
      `${config.displayName} does not support ${types.join(' or ')}. Cannot load: ${namesList}`
    );
    return;
  }

  // Fetch full content for each item
  try {
    const contentItems = await Promise.all(
      summaries.map(async (s) => {
        const repo = resolvedRepos.find((r) => r.url === s.repoUrl);
        if (!repo) throw new Error(`Repo not found for ${s.filePath}`);
        const content = await contentScanner.getContent(repoManager, repo, s.filePath, s);
        if (!content) throw new Error(`Could not read ${s.filePath}`);
        return content;
      })
    );

    const result = await equipmentService.equipItems(contentItems, agentId, workspaceRoot);

    if (result.success) {
      vscode.window.showInformationMessage(result.message);
      treeProvider.clearChecked();
    } else {
      vscode.window.showErrorMessage(result.message);
    }
  } catch (err) {
    logger.error(`Load failed: ${err}`);
    vscode.window.showErrorMessage(`Agent Tools Loadout: Load failed — ${err}`);
  }
}

async function pickAgent(): Promise<AgentId | undefined> {
  const defaultAgent = vscode.workspace
    .getConfiguration()
    .get<string>(CONFIG_KEYS.DEFAULT_AGENT, 'cursor');

  const agents = Object.values(AGENT_CONFIGS);
  agents.sort((a, b) => {
    if (a.id === defaultAgent) return -1;
    if (b.id === defaultAgent) return 1;
    return 0;
  });

  const picked = await vscode.window.showQuickPick(
    agents.map((a) => ({
      label: a.displayName,
      id: a.id,
    })),
    { placeHolder: 'Select target agent' }
  );

  return picked?.id as AgentId | undefined;
}
