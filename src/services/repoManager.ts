import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { ResolvedRepo } from '../types';
import { gitClone, gitPull, isGitRepo } from '../utils/git';
import * as logger from '../utils/logger';

/**
 * Manages a local cache of cloned repositories.
 * Each repo is stored in globalStorageUri/repos/<hash>.
 */
export class RepoManager {
  private readonly reposDir: string;

  constructor(globalStoragePath: string) {
    this.reposDir = path.join(globalStoragePath, 'repos');
  }

  /**
   * Ensure the cache directory exists.
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.reposDir, { recursive: true });
  }

  /**
   * Clone if not cached, pull if already cached.
   * Returns whether the repo content changed.
   */
  async syncRepo(repo: ResolvedRepo): Promise<{ changed: boolean }> {
    const localPath = this.getRepoLocalPath(repo);

    if (await isGitRepo(localPath)) {
      // Already cloned — pull latest
      try {
        const result = await gitPull(localPath);
        logger.info(`Pulled ${repo.displayName}: ${result.changed ? 'updated' : 'up to date'}`);
        return result;
      } catch (err) {
        logger.warn(`Pull failed for ${repo.displayName}, re-cloning: ${err}`);
        await this.removeRepoDir(localPath);
      }
    }

    // Clone fresh
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    try {
      await gitClone(repo.url, localPath, repo.branch);
      logger.info(`Cloned ${repo.displayName}`);
      return { changed: true };
    } catch (err) {
      logger.error(`Clone failed for ${repo.displayName}: ${err}`);
      throw err;
    }
  }

  /**
   * Sync all repos in parallel.
   * Returns a map of repo sourceId to sync result.
   */
  async syncAllRepos(
    repos: ResolvedRepo[]
  ): Promise<Map<string, { changed: boolean; error?: string }>> {
    const results = new Map<string, { changed: boolean; error?: string }>();

    const settled = await Promise.allSettled(
      repos.map(async (repo) => {
        try {
          const result = await this.syncRepo(repo);
          return { sourceId: repo.sourceId, result, error: undefined };
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          return { sourceId: repo.sourceId, result: { changed: false }, error: errorMsg };
        }
      })
    );

    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        const { sourceId, result, error } = outcome.value;
        if (error) {
          results.set(sourceId, { changed: false, error });
          logger.error(`Repo sync failed for ${sourceId}: ${error}`);
        } else {
          results.set(sourceId, result);
        }
      }
    }

    return results;
  }

  /**
   * Get the local filesystem path for a repo's cache directory.
   */
  getRepoLocalPath(repo: ResolvedRepo): string {
    const hash = crypto
      .createHash('sha256')
      .update(`${repo.url}:${repo.branch ?? 'default'}`)
      .digest('hex')
      .slice(0, 16);
    return path.join(this.reposDir, hash);
  }

  /**
   * Remove a repo from the cache.
   */
  async removeRepo(repo: ResolvedRepo): Promise<void> {
    const localPath = this.getRepoLocalPath(repo);
    await this.removeRepoDir(localPath);
    logger.info(`Removed cached repo: ${repo.displayName}`);
  }

  /**
   * Purge all cached repos. Forces fresh clones on next sync.
   */
  async purgeAll(): Promise<void> {
    await this.removeRepoDir(this.reposDir);
    logger.info('Purged all cached repos');
  }

  private async removeRepoDir(dirPath: string): Promise<void> {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
    } catch {
      // Ignore errors during cleanup
    }
  }
}
