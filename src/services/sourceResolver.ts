import type { SourceConfig, ResolvedRepo } from '../types';
import { getOrgPolicy, validateOrigin } from './orgPolicy';
import * as logger from '../utils/logger';

/**
 * Resolves source configurations into concrete repo URLs.
 * Currently only supports RepoSource — returns a single ResolvedRepo per source.
 */
export class SourceResolver {
  async resolveSource(source: SourceConfig): Promise<ResolvedRepo[]> {
    return [this.resolveRepoSource(source)];
  }

  async resolveAllSources(sources: SourceConfig[]): Promise<ResolvedRepo[]> {
    const policy = getOrgPolicy();

    return sources
      .filter((s) => {
        if (!s || typeof s.url !== 'string' || s.url.trim().length === 0) return false;

        // Preloaded sources are always trusted
        if (s.isPreloaded) return true;

        // Validate origin against policy (defense-in-depth for manually edited settings)
        if (policy.allowedOrigins.length > 0 || policy.blockPublicSources) {
          const result = validateOrigin(s.url);
          if (!result.allowed) {
            logger.warn(`Blocked source "${s.url}": ${result.reason}`);
            return false;
          }
        }
        return true;
      })
      .map((s) => this.resolveRepoSource(s));
  }

  private resolveRepoSource(source: SourceConfig): ResolvedRepo {
    const url = source.url.trim();
    return {
      url,
      branch: source.branch,
      path: source.path,
      sourceId: `repo:${url}`,
      displayName: source.name ?? extractRepoName(url),
      isPreloaded: source.isPreloaded,
    };
  }
}

function extractRepoName(url: string): string {
  // Handle both HTTPS and SSH URLs
  // https://github.com/org/repo.git → repo
  // git@github.com:org/repo.git → repo
  const httpsMatch = url.match(/\/([^/]+?)(?:\.git)?$/);
  if (httpsMatch) return httpsMatch[1];
  const sshMatch = url.match(/:([^/]+\/)?([^/]+?)(?:\.git)?$/);
  if (sshMatch) return sshMatch[2];
  return url;
}
