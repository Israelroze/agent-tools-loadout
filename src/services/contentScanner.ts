import { Worker } from 'worker_threads';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  ContentSummary,
  ContentItem,
  ScanRequest,
  ScanResult,
  ResolvedRepo,
} from '../types';
import type { RepoManager } from './repoManager';
import { parseContentFile } from './metadataParser';
import * as logger from '../utils/logger';

const SENSITIVITY_THRESHOLDS: Record<string, number> = {
  low: 10,
  medium: 40,
  high: 70,
};

export interface ScanResults {
  /** Items keyed by sourceId */
  items: Map<string, ContentSummary[]>;
  /** Errors keyed by sourceId */
  errors: Map<string, string>;
}

/**
 * Orchestrates scanning of cached repos via a worker thread.
 * Keeps the main VS Code extension host thread responsive.
 */
export class ContentScanner {
  private worker: Worker | null = null;
  private cache: ScanResults | null = null;
  private _gitPath: string = 'git';

  constructor(private readonly workerPath: string) {}

  /** Set the git binary path to pass to the worker thread. */
  setGitPath(gitPath: string): void {
    this._gitPath = gitPath;
    // If worker already exists, terminate it so it restarts with the new path
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * Scan all resolved repos. Delegates heavy work to the worker thread.
   * Uses cache — only re-scans repos where changed=true.
   */
  async scanRepos(
    resolvedRepos: ResolvedRepo[],
    repoManager: RepoManager,
    changedRepos: Set<string>
  ): Promise<ScanResults> {
    // Build scan request for repos that changed (or if no cache)
    const reposToScan = resolvedRepos.filter(
      (r) => !this.cache || changedRepos.has(r.sourceId)
    );

    if (reposToScan.length === 0 && this.cache) {
      return this.cache;
    }

    const sensitivity = vscode.workspace
      .getConfiguration()
      .get<string>('agentLoadout.sensitivity', 'low');
    const threshold = SENSITIVITY_THRESHOLDS[sensitivity] ?? SENSITIVITY_THRESHOLDS.low;

    const scanRequest: ScanRequest = {
      type: 'scan',
      threshold,
      repos: reposToScan.map((r) => ({
        localPath: repoManager.getRepoLocalPath(r),
        repoUrl: r.url,
        scanPath: r.path,
      })),
    };

    const scanResult = await this.runWorker(scanRequest);

    // Merge new scan results into cache
    const results: ScanResults = this.cache ?? {
      items: new Map(),
      errors: new Map(),
    };

    for (const repoResult of scanResult.repos) {
      const repo = resolvedRepos.find((r) => r.url === repoResult.repoUrl);
      if (!repo) continue;

      if (repoResult.error) {
        results.errors.set(repo.sourceId, repoResult.error);
        continue;
      }

      results.errors.delete(repo.sourceId);
      results.items.set(repo.sourceId, repoResult.items);
    }

    this.cache = results;
    return results;
  }

  /**
   * Read full content of a specific file from the cached repo.
   * This runs on the main thread since it's a single small file read.
   */
  async getContent(
    repoManager: RepoManager,
    repo: ResolvedRepo,
    filePath: string,
    summary?: ContentSummary
  ): Promise<ContentItem | null> {
    const localPath = repoManager.getRepoLocalPath(repo);
    const fullPath = path.join(localPath, filePath);

    try {
      const raw = await fs.readFile(fullPath, 'utf-8');
      const { metadata, content } = parseContentFile(raw, filePath);

      return {
        id: `${repo.url}:${filePath}`,
        repoUrl: repo.url,
        filePath,
        metadata,
        content,
        gitInfo: summary?.gitInfo,
      };
    } catch (err) {
      logger.error(`Failed to read content: ${filePath}: ${err}`);
      return null;
    }
  }

  clearCache(): void {
    this.cache = null;
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
  }

  private runWorker(request: ScanRequest): Promise<ScanResult> {
    return new Promise((resolve, reject) => {
      const worker = this.getWorker();
      const timeout = setTimeout(() => {
        reject(new Error('Worker scan timed out after 60s'));
      }, 60000);

      const handler = (msg: ScanResult) => {
        if (msg.type === 'result') {
          clearTimeout(timeout);
          worker.off('message', handler);
          resolve(msg);
        }
      };

      worker.on('message', handler);
      worker.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      worker.postMessage(request);
    });
  }

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(this.workerPath, {
        workerData: { gitPath: this._gitPath },
      });
      this.worker.on('error', (err) => {
        logger.error(`Scan worker error: ${err.message}`);
        this.worker = null;
      });
    }
    return this.worker;
  }
}
