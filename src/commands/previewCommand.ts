import * as vscode from 'vscode';
import type { ResolvedRepo, ContentItem } from '../types';
import type { ContentScanner } from '../services/contentScanner';
import type { RepoManager } from '../services/repoManager';
import type { ContentTreeItem } from '../ui/loadoutTreeItems';
import * as logger from '../utils/logger';

const activePanels = new Map<string, vscode.WebviewPanel>();

export async function previewCommand(
  item: ContentTreeItem,
  resolvedRepos: ResolvedRepo[],
  contentScanner: ContentScanner,
  repoManager: RepoManager
): Promise<void> {
  const summary = item.summary;
  const repo = resolvedRepos.find((r) => r.url === summary.repoUrl);
  if (!repo) {
    vscode.window.showErrorMessage('Agent Tools Loadout: Could not find source repo.');
    return;
  }

  // Reuse existing panel for the same file
  const existing = activePanels.get(summary.id);
  if (existing) {
    existing.reveal(vscode.ViewColumn.Beside);
    return;
  }

  try {
    const content = await contentScanner.getContent(repoManager, repo, summary.filePath, summary);
    if (!content) {
      vscode.window.showErrorMessage('Agent Tools Loadout: Could not read content.');
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'agentLoadoutPreview',
      summary.metadata.name,
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: false, enableFindWidget: true }
    );

    panel.iconPath = new vscode.ThemeIcon('file-code');
    panel.webview.html = buildPreviewHtml(content);

    activePanels.set(summary.id, panel);
    panel.onDidDispose(() => activePanels.delete(summary.id));
  } catch (err) {
    logger.error(`Preview failed: ${err}`);
    vscode.window.showErrorMessage(`Agent Tools Loadout: Preview failed — ${err}`);
  }
}

function buildPreviewHtml(item: ContentItem): string {
  const meta = item.metadata;
  const git = item.gitInfo;

  const contentTypeLabel: Record<string, string> = {
    instructions: 'Instructions',
    skill: 'Skill',
    subagent: 'Sub-agent',
  };

  const metaBadges: string[] = [];
  metaBadges.push(badge(contentTypeLabel[meta.contentType] ?? meta.contentType, 'content-type'));
  if (meta.type) metaBadges.push(badge(meta.type));
  if (meta.level) metaBadges.push(badge(meta.level));
  if (meta.tags) meta.tags.forEach((t) => metaBadges.push(badge(t)));
  if (meta.techStack) meta.techStack.forEach((t) => metaBadges.push(badge(t, 'tech')));

  const badgesHtml = metaBadges.length > 0
    ? `<div class="badges">${metaBadges.join('')}</div>`
    : '';

  const descHtml = meta.description
    ? `<p class="description">${escapeHtml(meta.description)}</p>`
    : '';

  const gitHtml = git
    ? `<div class="git-info">Last updated by <strong>${escapeHtml(git.lastAuthor)}</strong> on ${git.lastDate.split('T')[0]} &mdash; <em>"${escapeHtml(git.lastMessage)}"</em></div>`
    : '';

  const authorHtml = meta.author
    ? `<div class="author">Author: ${escapeHtml(meta.author)}${meta.version ? ` &middot; v${escapeHtml(meta.version)}` : ''}</div>`
    : '';

  const contentHtml = escapeHtml(item.content);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 20px 28px;
      line-height: 1.6;
      max-width: 800px;
    }
    .header {
      border-bottom: 1px solid var(--vscode-widget-border, #444);
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    h1 {
      margin: 0 0 4px 0;
      font-size: 1.5em;
      color: var(--vscode-foreground);
    }
    .filepath {
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
      font-family: var(--vscode-editor-font-family, monospace);
      margin-bottom: 10px;
    }
    .description {
      margin: 8px 0;
      color: var(--vscode-foreground);
    }
    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 10px 0;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.8em;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
    .badge.tech {
      background: var(--vscode-extensionBadge-remoteForeground, var(--vscode-badge-background));
    }
    .badge.content-type {
      background: var(--vscode-statusBarItem-prominentBackground, var(--vscode-badge-background));
      font-weight: 600;
    }
    .git-info, .author {
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
      margin: 4px 0;
    }
    .content {
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: var(--vscode-editor-font-size, 13px);
      background: var(--vscode-textCodeBlock-background, rgba(128,128,128,0.1));
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(meta.name)}</h1>
    <div class="filepath">${escapeHtml(item.filePath)}</div>
    ${descHtml}
    ${badgesHtml}
    ${authorHtml}
    ${gitHtml}
  </div>
  <pre class="content">${contentHtml}</pre>
</body>
</html>`;
}

function badge(text: string, cssClass = ''): string {
  return `<span class="badge ${cssClass}">${escapeHtml(text)}</span>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
