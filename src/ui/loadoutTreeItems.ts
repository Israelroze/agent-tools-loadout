import * as vscode from 'vscode';
import type { ContentSummary, ContentType, SourceConfig } from '../types';
import { COMMANDS } from '../utils/constants';

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  instructions: 'Instructions',
  skill: 'Skills',
  subagent: 'Sub-agents',
};

const CONTENT_TYPE_ICONS: Record<ContentType, string> = {
  instructions: 'book',
  skill: 'wand',
  subagent: 'person',
};

/**
 * Top-level node representing a source repo.
 */
export class SourceTreeItem extends vscode.TreeItem {
  constructor(
    public readonly source: SourceConfig,
    public readonly displayName: string,
    childCount: number,
    public readonly isPreloaded = false
  ) {
    super(displayName, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = isPreloaded ? 'source-preloaded' : 'source';
    this.description = isPreloaded ? `${childCount} items (org)` : `${childCount} items`;
    this.iconPath = new vscode.ThemeIcon(isPreloaded ? 'lock' : 'repo');
    this.tooltip = isPreloaded
      ? `${source.url}\n(Organization source — cannot be removed)`
      : source.url;
  }
}

/**
 * Collapsible group node for content type grouping (Instructions, Skills, Sub-agents).
 */
export class ContentTypeGroupItem extends vscode.TreeItem {
  constructor(
    public readonly contentType: ContentType,
    public readonly sourceId: string,
    childCount: number
  ) {
    super(CONTENT_TYPE_LABELS[contentType], vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = 'contentTypeGroup';
    this.iconPath = new vscode.ThemeIcon(CONTENT_TYPE_ICONS[contentType]);
    this.description = `${childCount}`;
  }
}

/**
 * Leaf node representing a single content/instruction file.
 */
export class ContentTreeItem extends vscode.TreeItem {
  constructor(
    public readonly summary: ContentSummary,
    isLoaded = false,
    isStale = false
  ) {
    super(summary.metadata.name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = isLoaded && isStale ? 'content-stale' : isLoaded ? 'content-loaded' : 'content';
    if (isLoaded && isStale) {
      this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
    } else if (isLoaded) {
      this.iconPath = new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('charts.blue'));
    } else {
      this.iconPath = new vscode.ThemeIcon(CONTENT_TYPE_ICONS[summary.metadata.contentType]);
    }
    this.checkboxState = vscode.TreeItemCheckboxState.Unchecked;

    // Description: loaded/stale status takes priority, then git info
    if (isLoaded && isStale) {
      this.description = '⚠ updated since loaded';
    } else if (isLoaded) {
      this.description = '(loaded)';
    } else if (summary.gitInfo) {
      const relDate = formatRelativeDate(summary.gitInfo.lastDate);
      this.description = `${summary.gitInfo.lastAuthor}, ${relDate}`;
    } else if (summary.metadata.description) {
      this.description = summary.metadata.description;
    }

    // Rich tooltip
    this.tooltip = buildTooltip(summary, isLoaded, isStale);

    // Click to preview
    this.command = {
      command: COMMANDS.PREVIEW,
      title: 'Preview',
      arguments: [this],
    };
  }
}

/**
 * Message node for empty/error states.
 */
export class MessageTreeItem extends vscode.TreeItem {
  constructor(message: string, isError = false) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'message';
    this.iconPath = new vscode.ThemeIcon(isError ? 'warning' : 'info');
  }
}

function buildTooltip(summary: ContentSummary, isLoaded = false, isStale = false): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.appendMarkdown(`**${summary.metadata.name}**\n\n`);

  if (isLoaded && isStale) {
    md.appendMarkdown(`⚠ **Updated in source repo since last loaded**\n\n`);
  } else if (isLoaded) {
    md.appendMarkdown(`✓ Loaded into this project\n\n`);
  }

  if (summary.metadata.description) {
    md.appendMarkdown(`${summary.metadata.description}\n\n`);
  }

  if (summary.metadata.tags && summary.metadata.tags.length > 0) {
    md.appendMarkdown(`**Tags:** ${summary.metadata.tags.join(', ')}\n\n`);
  }

  if (summary.metadata.level) {
    md.appendMarkdown(`**Level:** ${summary.metadata.level}\n\n`);
  }

  md.appendMarkdown(`**Content Type:** ${CONTENT_TYPE_LABELS[summary.metadata.contentType]}\n\n`);

  if (summary.metadata.type) {
    md.appendMarkdown(`**Type:** ${summary.metadata.type}\n\n`);
  }

  if (summary.gitInfo) {
    md.appendMarkdown('---\n\n');
    md.appendMarkdown(`Last updated by **${summary.gitInfo.lastAuthor}**\n\n`);
    md.appendMarkdown(`${summary.gitInfo.lastDate.split('T')[0]} — *"${summary.gitInfo.lastMessage}"*\n`);
  }

  md.appendMarkdown(`\n\n\`${summary.filePath}\``);

  return md;
}

function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}
