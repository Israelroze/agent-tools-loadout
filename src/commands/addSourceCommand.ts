import * as vscode from 'vscode';
import type { SourceConfig } from '../types';
import { CONFIG_KEYS } from '../utils/constants';
import { getOrgPolicy, validateOrigin } from '../services/orgPolicy';

/**
 * Wizard to add a new repo source.
 */
export async function addSourceCommand(): Promise<void> {
  const policy = getOrgPolicy();
  const hasRestrictions = policy.allowedOrigins.length > 0 || policy.blockPublicSources;

  let prompt = 'Repository URL (HTTPS or SSH)';
  if (policy.blockPublicSources && policy.allowedOrigins.length === 0) {
    prompt = 'Repository URL (public sources are blocked — only preloaded sources allowed)';
  } else if (policy.allowedOrigins.length > 0) {
    prompt = `Repository URL (allowed: ${policy.allowedOrigins.join(', ')})`;
  }

  const url = await vscode.window.showInputBox({
    prompt,
    placeHolder: 'https://github.com/org/repo.git or git@github.com:org/repo.git',
    validateInput: (v) => {
      const trimmed = v.trim();
      if (!trimmed) return 'URL is required';
      if (hasRestrictions) {
        const result = validateOrigin(trimmed);
        if (!result.allowed) return result.reason;
      }
      return null;
    },
  });
  if (!url) return;

  const branch = await vscode.window.showInputBox({
    prompt: 'Branch (leave empty for default)',
    placeHolder: 'default',
  });

  const path = await vscode.window.showInputBox({
    prompt: 'Subdirectory path (leave empty for repo root)',
    placeHolder: 'skills',
  });

  const newSource: SourceConfig = {
    type: 'repo',
    url: url.trim(),
    branch: branch?.trim() || undefined,
    path: path?.trim() || undefined,
  };

  // Add to settings
  const config = vscode.workspace.getConfiguration();
  const currentSources = config.get<SourceConfig[]>(CONFIG_KEYS.SOURCES, []);
  currentSources.push(newSource);
  await config.update(CONFIG_KEYS.SOURCES, currentSources, vscode.ConfigurationTarget.Global);

  vscode.window.showInformationMessage('Agent Tools Loadout: Source added. Click refresh to load.');
}
