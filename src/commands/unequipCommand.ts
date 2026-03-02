import * as vscode from 'vscode';
import * as path from 'path';
import type { AgentId } from '../types';
import { AGENT_CONFIGS, CONFIG_KEYS } from '../utils/constants';
import * as logger from '../utils/logger';

/**
 * Remove equipped files from the workspace.
 * Shows a file picker with all files in the selected agent's rules directory.
 */
export async function unequipCommand(): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('Agent Tools Loadout: No workspace folder open.');
    return;
  }

  // Pick target agent
  const agentId = await pickAgent();
  if (!agentId) return;

  const config = AGENT_CONFIGS[agentId];
  if (!config.rulesDir) {
    vscode.window.showErrorMessage(`Agent Tools Loadout: ${config.displayName} does not have a rules directory.`);
    return;
  }

  // Collect all unique directories for this agent (primary + per-type overrides)
  const allRelDirs = new Set<string>([config.rulesDir]);
  for (const dir of Object.values(config.contentTypeDirs ?? {})) {
    allRelDirs.add(dir);
  }

  // Read files from all directories, labelled with their relative path
  interface EquippedFile { label: string; absPath: string; }
  const allFiles: EquippedFile[] = [];

  for (const relDir of allRelDirs) {
    const absDir = path.join(workspaceRoot, relDir);
    try {
      const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(absDir));
      for (const [name, type] of entries) {
        if (type === vscode.FileType.File) {
          allFiles.push({
            label: `${relDir}/${name}`,
            absPath: path.join(absDir, name),
          });
        }
      }
    } catch {
      // Directory doesn't exist yet, skip
    }
  }

  if (allFiles.length === 0) {
    vscode.window.showInformationMessage(`Agent Tools Loadout: No equipped files found for ${config.displayName}.`);
    return;
  }

  // Let user pick files to remove
  const quickPickItems = allFiles.map((f) => ({ label: f.label, absPath: f.absPath, picked: false }));
  const picked = await vscode.window.showQuickPick(quickPickItems, {
    canPickMany: true,
    placeHolder: `Select files to remove from ${config.displayName}`,
  });

  if (!picked || picked.length === 0) return;

  // Delete selected files
  let deleted = 0;
  for (const item of picked) {
    try {
      await vscode.workspace.fs.delete(vscode.Uri.file(item.absPath));
      deleted++;
    } catch (err) {
      logger.error(`Failed to delete ${item.label}: ${err}`);
    }
  }

  if (deleted > 0) {
    const msg = deleted === 1
      ? `Removed "${picked[0].label}"`
      : `Removed ${deleted} files from ${config.displayName}`;
    vscode.window.showInformationMessage(`Agent Tools Loadout: ${msg}`);
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
      description: `${a.rulesDir}/`,
      id: a.id,
    })),
    { placeHolder: 'Select agent to unequip from' }
  );

  return picked?.id as AgentId | undefined;
}
