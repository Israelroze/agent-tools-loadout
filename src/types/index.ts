// ── Source Configuration ──

export interface RepoSource {
  type: 'repo';
  url: string;
  branch?: string;
  path?: string;
  name?: string;
  /** Set internally when source comes from org policy. Not user-configurable. */
  isPreloaded?: boolean;
}

export type SourceConfig = RepoSource;

// ── Resolved Repo (output of source resolution) ──

export interface ResolvedRepo {
  url: string;
  /** Branch to clone. Undefined = use remote's default branch. */
  branch?: string;
  path?: string;
  sourceId: string;
  displayName: string;
  /** True if this source comes from the org policy and cannot be removed. */
  isPreloaded?: boolean;
}

// ── Git Metadata ──

export interface GitFileInfo {
  lastAuthor: string;
  lastDate: string;
  lastMessage: string;
  sha: string;
}

// ── Content Types ──

export type ContentType = 'instructions' | 'skill' | 'subagent';

export interface ContentMetadata {
  name: string;
  description: string;
  /** Content classification: instructions, skill, or subagent */
  contentType: ContentType;
  type?: string;
  level?: string;
  tags?: string[];
  techStack?: string[];
  author?: string;
  version?: string;
}

export interface ContentSummary {
  id: string;
  repoUrl: string;
  filePath: string;
  metadata: ContentMetadata;
  gitInfo?: GitFileInfo;
  /** Relevance score 0–100 from the content scoring system */
  relevanceScore?: number;
}

export interface ContentItem extends ContentSummary {
  content: string;
}

// ── Agent Types ──

export type AgentId = 'copilot' | 'cursor' | 'claude';

export interface AgentConfig {
  id: AgentId;
  displayName: string;
  /** Single-file target path (used by convert command) */
  targetPath: string;
  /** Directory for multi-file equip. When set, each item becomes a separate file here. */
  rulesDir?: string;
  /** File extension for individual rule files in rulesDir */
  ruleFileExt?: string;
  /** Content types this agent supports */
  supportedContentTypes: ContentType[];
  /** Per-content-type directory overrides. Takes precedence over rulesDir for that type. */
  contentTypeDirs?: Partial<Record<ContentType, string>>;
  /** Per-content-type file extension overrides. Takes precedence over ruleFileExt for that type. */
  contentTypeExts?: Partial<Record<ContentType, string>>;
}

// ── Equipped State Tracking ──

export interface EquippedRecord {
  /** Relative path where the file was written in the workspace */
  path: string;
  /** Timestamp (ms) when the item was loaded */
  equippedAt: number;
  /** gitInfo.lastDate at the time of loading — used to detect staleness */
  lastModified?: string;
}

/** Map of item ID → EquippedRecord, stored in workspaceState */
export type EquippedMap = Record<string, EquippedRecord>;

// ── Equipment ──

export interface EquipResult {
  success: boolean;
  agent: AgentId;
  targetPath: string;
  itemCount: number;
  message: string;
}

// ── Format Conversion ──

export interface NormalizedContent {
  sections: Array<{
    heading?: string;
    content: string;
  }>;
  rawContent: string;
}

// ── Worker Thread Messages ──

export interface ScanRequest {
  type: 'scan';
  /** Minimum relevance score (0–100) for a file to be included */
  threshold: number;
  repos: Array<{
    localPath: string;
    repoUrl: string;
    scanPath?: string;
  }>;
}

export interface ScanResult {
  type: 'result';
  repos: Array<{
    repoUrl: string;
    items: ContentSummary[];
    error?: string;
  }>;
}
