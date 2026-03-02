import * as vscode from 'vscode';
import type { AgentId } from '../types';
import type { EquipmentService } from '../services/equipmentService';
import { AGENT_CONFIGS } from '../utils/constants';
import * as logger from '../utils/logger';

export async function convertCommand(
  equipmentService: EquipmentService
): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('Agent Tools Loadout: No workspace folder open.');
    return;
  }

  const agents = Object.values(AGENT_CONFIGS);

  // Pick source agent
  const source = await vscode.window.showQuickPick(
    agents.map((a) => ({
      label: a.displayName,
      description: a.targetPath,
      id: a.id,
    })),
    { placeHolder: 'Convert FROM which agent?' }
  );
  if (!source) return;

  // Pick target agent (exclude source)
  const target = await vscode.window.showQuickPick(
    agents
      .filter((a) => a.id !== source.id)
      .map((a) => ({
        label: a.displayName,
        description: a.targetPath,
        id: a.id,
      })),
    { placeHolder: 'Convert TO which agent?' }
  );
  if (!target) return;

  try {
    const result = await equipmentService.convert(
      source.id as AgentId,
      target.id as AgentId,
      workspaceRoot
    );

    if (result.success) {
      vscode.window.showInformationMessage(result.message);
    } else {
      vscode.window.showErrorMessage(result.message);
    }
  } catch (err) {
    logger.error(`Convert failed: ${err}`);
    vscode.window.showErrorMessage(`Agent Tools Loadout: Convert failed — ${err}`);
  }
}
