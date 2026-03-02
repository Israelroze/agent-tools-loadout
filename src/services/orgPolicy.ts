import * as vscode from 'vscode';
import type { SourceConfig } from '../types';
import { CONFIG_KEYS } from '../utils/constants';

// Inlined at build time by esbuild — immutable at runtime.
// Organizations fork the repo, edit config.json, and rebuild the VSIX.
import defaultPolicy from '../../config.json';

export interface OrgPolicy {
  preloadedSources: SourceConfig[];
  allowedOrigins: string[];
  blockPublicSources: boolean;
}

const policy: OrgPolicy = {
  preloadedSources: (defaultPolicy.preloadedSources ?? []) as SourceConfig[],
  allowedOrigins: (defaultPolicy.allowedOrigins ?? []).map((o: string) => o.toLowerCase()),
  blockPublicSources: defaultPolicy.blockPublicSources ?? false,
};

export function getOrgPolicy(): OrgPolicy {
  return policy;
}

/**
 * Extract the origin (host + org/group path) from a git URL.
 * Drops the final path segment (the repo name).
 *
 * HTTPS: https://github.acme-corp.com/team/repo.git  →  github.acme-corp.com/team
 * SSH:   git@github.acme-corp.com:team/repo.git      →  github.acme-corp.com/team
 * Nested: https://gitlab.corp.com/group/sub/repo.git → gitlab.corp.com/group/sub
 */
export function extractOrigin(url: string): string | null {
  // HTTPS pattern
  const httpsMatch = url.match(/^https?:\/\/([^/]+)\/(.+?)(?:\.git)?$/);
  if (httpsMatch) {
    const host = httpsMatch[1].toLowerCase();
    const pathParts = httpsMatch[2].split('/');
    const orgPath = pathParts.slice(0, -1).join('/').toLowerCase();
    return orgPath ? `${host}/${orgPath}` : host;
  }

  // SSH pattern: git@host:org/repo.git  or  ssh://git@host/org/repo.git
  const sshMatch = url.match(/^(?:ssh:\/\/)?(?:[^@]+@)?([^:/]+)[:/](.+?)(?:\.git)?$/);
  if (sshMatch) {
    const host = sshMatch[1].toLowerCase();
    const pathParts = sshMatch[2].split('/');
    const orgPath = pathParts.slice(0, -1).join('/').toLowerCase();
    return orgPath ? `${host}/${orgPath}` : host;
  }

  return null;
}

/**
 * Pure validation function — testable without module-level policy state.
 * Checks if url's origin matches any entry in allowedOrigins (prefix match with `/` boundary).
 */
export function validateOriginAgainst(
  url: string,
  allowedOrigins: string[]
): { allowed: true } | { allowed: false; reason: string } {
  if (allowedOrigins.length === 0) {
    return { allowed: true };
  }

  const origin = extractOrigin(url);
  if (!origin) {
    return { allowed: false, reason: `Could not parse origin from URL: ${url}` };
  }

  const matches = allowedOrigins.some(
    (allowed) => origin === allowed || origin.startsWith(allowed + '/')
  );

  if (matches) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Repository origin "${origin}" is not allowed. Allowed: ${allowedOrigins.join(', ')}`,
  };
}

/**
 * Validate a repo URL against the org policy.
 * Blocks when: allowedOrigins is non-empty and URL doesn't match,
 * OR blockPublicSources is true and allowedOrigins is empty (block everything).
 */
export function validateOrigin(
  url: string
): { allowed: true } | { allowed: false; reason: string } {
  if (policy.allowedOrigins.length > 0) {
    return validateOriginAgainst(url, policy.allowedOrigins);
  }
  if (policy.blockPublicSources) {
    return {
      allowed: false,
      reason: 'Public sources are blocked by organization policy. Only preloaded sources are allowed.',
    };
  }
  return { allowed: true };
}

/**
 * Check if a source is org-managed (preloaded). Matches by URL (case-insensitive).
 */
export function isPreloadedSource(source: SourceConfig): boolean {
  if (!source || typeof source.url !== 'string') return false;
  const url = source.url.trim().toLowerCase();
  return policy.preloadedSources.some((p) => p.url.trim().toLowerCase() === url);
}

/**
 * Merge preloaded sources with user sources from settings.
 * Preloaded sources are marked with isPreloaded and appear first.
 * Duplicates (same URL) are resolved in favor of the preloaded version.
 */
export function getEffectiveSources(): SourceConfig[] {
  const rawUserSources = vscode.workspace
    .getConfiguration()
    .get<SourceConfig[]>(CONFIG_KEYS.SOURCES, []);

  // Guard against malformed entries in settings (missing or non-string url)
  const userSources = rawUserSources.filter(
    (s) => s && typeof s.url === 'string' && s.url.trim().length > 0
  );

  const preloaded: SourceConfig[] = policy.preloadedSources
    .filter((s) => s && typeof s.url === 'string' && s.url.trim().length > 0)
    .map((s) => ({ ...s, isPreloaded: true }));

  const preloadedUrls = new Set(preloaded.map((s) => s.url.trim().toLowerCase()));
  const dedupedUser = userSources.filter(
    (s) => !preloadedUrls.has(s.url.trim().toLowerCase())
  );

  return [...preloaded, ...dedupedUser];
}
