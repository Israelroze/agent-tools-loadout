import * as vscode from 'vscode';
import type { SourceConfig, ContentSummary, ContentType, ResolvedRepo, EquippedMap } from '../types';
import type { ScanResults } from '../services/contentScanner';
import {
  SourceTreeItem,
  ContentTypeGroupItem,
  ContentTreeItem,
  MessageTreeItem,
} from './loadoutTreeItems';

type TreeNode =
  | SourceTreeItem
  | ContentTypeGroupItem
  | ContentTreeItem
  | MessageTreeItem;

const DEBOUNCE_MS = 250;

/** The order content types appear in the tree. */
const CONTENT_TYPE_ORDER: ContentType[] = ['instructions', 'skill', 'subagent'];

/**
 * TreeDataProvider for the Agent Tools Loadout sidebar.
 * Tree: Source → Content Type → Content Items
 * Supports checkboxes for multi-select equip, free-text search, and content type filtering.
 */
export class LoadoutTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private sources: SourceConfig[] = [];
  private resolvedRepos: ResolvedRepo[] = [];
  private scanResults: ScanResults | null = null;
  private checkedItems = new Set<string>();
  private equippedMap: EquippedMap = {};
  private isLoading = false;
  private filterQuery = '';
  private filterTokens: string[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private typeFilter: ContentType | null = null;

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeNode): TreeNode[] {
    if (!element) {
      return this.getRootChildren();
    }

    if (element instanceof SourceTreeItem) {
      return this.getSourceChildren(element);
    }

    if (element instanceof ContentTypeGroupItem) {
      return this.getContentTypeChildren(element);
    }

    return [];
  }

  /**
   * Update the tree with new data.
   */
  update(
    sources: SourceConfig[],
    resolvedRepos: ResolvedRepo[],
    scanResults: ScanResults
  ): void {
    this.sources = sources;
    this.resolvedRepos = resolvedRepos;
    this.scanResults = scanResults;
    this.isLoading = false;
    this._onDidChangeTreeData.fire(undefined);
  }

  setLoading(loading: boolean): void {
    this.isLoading = loading;
    this._onDidChangeTreeData.fire(undefined);
  }

  /** Refresh the equipped map (call after equipping or on workspace change). */
  setEquippedMap(map: EquippedMap): void {
    this.equippedMap = map;
    this._onDidChangeTreeData.fire(undefined);
  }

  // ── Search / Filter ──

  /**
   * Set the search filter with debounce. Filters across all repos.
   */
  setFilter(query: string): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.filterQuery = query.trim();
      this.filterTokens = this.filterQuery.toLowerCase().split(/\s+/).filter(Boolean);
      this._onDidChangeTreeData.fire(undefined);
    }, DEBOUNCE_MS);
  }

  clearFilter(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.filterQuery = '';
    this.filterTokens = [];
    this._onDidChangeTreeData.fire(undefined);
  }

  get activeFilter(): string {
    return this.filterQuery;
  }

  // ── Content Type Filter ──

  setTypeFilter(type: ContentType | null): void {
    this.typeFilter = type;
    this._onDidChangeTreeData.fire(undefined);
  }

  get activeTypeFilter(): ContentType | null {
    return this.typeFilter;
  }

  /**
   * Handle checkbox state changes.
   */
  handleCheckboxChange(event: vscode.TreeCheckboxChangeEvent<TreeNode>): void {
    for (const [item, state] of event.items) {
      if (item instanceof ContentTreeItem) {
        if (state === vscode.TreeItemCheckboxState.Checked) {
          this.checkedItems.add(item.summary.id);
        } else {
          this.checkedItems.delete(item.summary.id);
        }
      }
    }
  }

  /**
   * Get all currently checked content summaries.
   */
  getCheckedItems(): ContentSummary[] {
    if (!this.scanResults) return [];

    const allItems: ContentSummary[] = [];
    for (const items of this.scanResults.items.values()) {
      allItems.push(...items);
    }

    return allItems.filter((item) => this.checkedItems.has(item.id));
  }

  clearChecked(): void {
    this.checkedItems.clear();
    this._onDidChangeTreeData.fire(undefined);
  }

  // ── Tree building ──

  private getRootChildren(): TreeNode[] {
    if (this.isLoading) {
      return [new MessageTreeItem('Loading sources...')];
    }

    if (this.sources.length === 0) {
      return [new MessageTreeItem('No sources configured. Use "Add Source" to get started.')];
    }

    if (!this.scanResults) {
      return [new MessageTreeItem('Click refresh to load content.')];
    }

    const nodes = this.sources
      .map((source) => {
        const count = this.countItemsForSource(source);
        if (this.hasFilter && count === 0) return null;
        const displayName = source.name ?? extractRepoName(source.url);
        return new SourceTreeItem(source, displayName, count, !!source.isPreloaded);
      })
      .filter((n): n is SourceTreeItem => n !== null);

    if (this.hasFilter && nodes.length === 0) {
      return [new MessageTreeItem(`No results for "${this.filterQuery}"`)];
    }

    return nodes;
  }

  private getSourceChildren(sourceItem: SourceTreeItem): TreeNode[] {
    const source = sourceItem.source;
    const repo = this.resolvedRepos.find((r) => r.sourceId === `repo:${source.url}`);
    if (!repo) return [new MessageTreeItem('Not synced yet')];

    const error = this.scanResults?.errors.get(repo.sourceId);
    if (error) {
      return [new MessageTreeItem(`Error: ${error}`, true)];
    }

    return this.buildTypeGroups(this.scanResults?.items.get(repo.sourceId) ?? [], repo.sourceId);
  }

  /**
   * Build content type group nodes from a list of items.
   * If all items are the same type, show them directly without grouping.
   */
  private buildTypeGroups(items: ContentSummary[], sourceId: string): TreeNode[] {
    const filtered = this.filterItems(items);
    if (filtered.length === 0) {
      return this.hasFilter ? [] : [new MessageTreeItem('No instruction files found')];
    }

    // Group by content type
    const byType = new Map<ContentType, ContentSummary[]>();
    for (const item of filtered) {
      const ct = item.metadata.contentType;
      if (!byType.has(ct)) byType.set(ct, []);
      byType.get(ct)!.push(item);
    }

    // If only one type exists, show items directly (no extra nesting)
    if (byType.size === 1) {
      return filtered.map((item) => this.makeContentTreeItem(item));
    }

    // Multiple types — show type group folders
    const nodes: TreeNode[] = [];
    for (const ct of CONTENT_TYPE_ORDER) {
      const typeItems = byType.get(ct);
      if (typeItems && typeItems.length > 0) {
        nodes.push(new ContentTypeGroupItem(ct, sourceId, typeItems.length));
      }
    }
    return nodes;
  }

  /**
   * Get content items for a specific content type group.
   */
  private getContentTypeChildren(typeGroup: ContentTypeGroupItem): TreeNode[] {
    const { sourceId, contentType } = typeGroup;
    const items = this.scanResults?.items.get(sourceId) ?? [];
    const filtered = this.filterItems(items).filter((i) => i.metadata.contentType === contentType);
    return filtered.map((item) => this.makeContentTreeItem(item));
  }

  private makeContentTreeItem(item: ContentSummary): ContentTreeItem {
    const record = this.equippedMap[item.id];
    const isLoaded = !!record;
    const isStale = isLoaded && !!item.gitInfo?.lastDate && item.gitInfo.lastDate !== record.lastModified;
    return new ContentTreeItem(item, isLoaded, isStale);
  }

  // ── Filter logic ──

  private get hasFilter(): boolean {
    return this.filterTokens.length > 0 || this.typeFilter !== null;
  }

  /**
   * Filter content items. All search tokens must match (AND logic).
   * Also applies content type filter if set.
   * Matches against: name, description, tags, techStack, filePath, author, contentType.
   */
  private filterItems(items: ContentSummary[]): ContentSummary[] {
    let result = items;

    // Apply type filter
    if (this.typeFilter) {
      result = result.filter((item) => item.metadata.contentType === this.typeFilter);
    }

    // Apply text filter
    if (this.filterTokens.length > 0) {
      result = result.filter((item) => {
        const searchable = [
          item.metadata.name,
          item.metadata.description,
          item.metadata.contentType,
          item.filePath,
          item.metadata.author ?? '',
          item.metadata.type ?? '',
          item.metadata.level ?? '',
          ...(item.metadata.tags ?? []),
          ...(item.metadata.techStack ?? []),
        ].join(' ').toLowerCase();

        return this.filterTokens.every((token) => searchable.includes(token));
      });
    }

    return result;
  }

  private countItemsForSource(source: SourceConfig): number {
    if (!this.scanResults) return 0;
    const key = `repo:${source.url}`;
    const items = this.scanResults.items.get(key);
    return items ? this.filterItems(items).length : 0;
  }
}

function extractRepoName(url: string | undefined): string {
  if (!url) return 'Unknown';
  const match = url.match(/\/([^/]+?)(?:\.git)?$/);
  return match?.[1] ?? url;
}
