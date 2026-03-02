import matter from 'gray-matter';
import * as path from 'path';
import type { ContentMetadata, ContentType } from '../types';

/**
 * Score a file's relevance as an agent instruction file (0–100).
 * Higher = stronger signal that this is intentional agent content.
 */
export function scoreContent(
  raw: string,
  filePath: string,
  insideInstructionDir: boolean
): number {
  let score = 0;
  const pathLower = filePath.toLowerCase();
  const baseName = path.basename(pathLower);

  // Exact known filenames (+30)
  const knownNames = new Set(['.cursorrules', '.clinerules', 'claude.md', 'copilot-instructions.md']);
  if (knownNames.has(baseName)) score += 30;

  // Inside a known instruction directory (+30)
  if (insideInstructionDir) score += 30;

  // Filename pattern matches (+20)
  if (baseName.endsWith('.agent.md') || baseName.endsWith('.prompt.md') || baseName.endsWith('.mdc')) score += 20;

  // Parse frontmatter to check for type and description fields
  let frontMatterType: string | undefined;
  let hasDescription = false;
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fmMatch) {
    const fm = fmMatch[1];
    const typeMatch = fm.match(/^type:\s*(.+)$/m);
    if (typeMatch) {
      frontMatterType = typeMatch[1].trim().replace(/^['"]|['"]$/g, '');
      score += 40; // Explicit type field is the strongest signal
    }
    if (/^description:/m.test(fm)) {
      hasDescription = true;
      score += 10;
    }
  }

  // Content heuristics (only if no frontmatter type — avoid double-counting)
  if (!frontMatterType) {
    const contentLower = raw.toLowerCase();
    const heuristicPatterns = [
      'you are a', 'act as a', 'your role is',
      '## role', '# role', '## persona',
      '## instructions', '# instructions', '## guidelines',
      'allowed-tools:', 'tool_use', '## usage',
    ];
    const matches = heuristicPatterns.filter((p) => contentLower.includes(p)).length;
    if (matches >= 2) score += 20;
    else if (matches === 1) score += 10;
  }

  // Suppress unused variable warning
  void hasDescription;

  return Math.min(score, 100);
}

/**
 * Parse YAML front-matter from a content file.
 * Returns the metadata and the body content (with front-matter stripped).
 */
export function parseContentFile(
  raw: string,
  filePath: string
): { metadata: ContentMetadata; content: string } {
  const { data, content } = matter(raw);

  const contentType = detectContentType(data.type, filePath, content);

  const metadata: ContentMetadata = {
    name: data.name ?? nameFromPath(filePath),
    description: data.description ?? '',
    contentType,
    type: data.type,
    level: data.level,
    tags: asStringArray(data.tags),
    techStack: asStringArray(data.techStack ?? data.tech_stack),
    author: data.author,
    version: data.version,
  };

  return { metadata, content: content.trim() };
}

/**
 * Detect content type from front-matter, file path, or content heuristics.
 *
 * Priority:
 * 1. Explicit front-matter `type` field (skill, subagent, agent, persona)
 * 2. File path patterns (agents/, skills/, subagents/, commands/)
 * 3. Content heuristics (agent/persona markers in the text)
 * 4. Default: instructions
 */
function detectContentType(
  frontMatterType: string | undefined,
  filePath: string,
  content: string
): ContentType {
  // 1. Explicit front-matter
  if (frontMatterType) {
    const t = frontMatterType.toLowerCase();
    if (t === 'skill' || t === 'command' || t === 'prompt') return 'skill';
    if (t === 'subagent' || t === 'agent' || t === 'persona') return 'subagent';
    return 'instructions';
  }

  // 2. File path patterns
  const pathLower = filePath.toLowerCase();
  const pathParts = pathLower.split('/');

  if (pathParts.some((p) => p === 'agents' || p === 'subagents' || p === 'personas')) {
    return 'subagent';
  }
  if (pathParts.some((p) => p === 'skills' || p === 'commands' || p === 'prompts')) {
    return 'skill';
  }

  // Check for agent-specific filename patterns
  const baseName = path.basename(pathLower);
  if (baseName.endsWith('.agent.md') || baseName.endsWith('.prompt.md')) {
    return baseName.endsWith('.agent.md') ? 'subagent' : 'skill';
  }

  // 3. Content heuristics — look for agent/persona markers
  const contentLower = content.toLowerCase();
  if (
    contentLower.includes('you are a') ||
    contentLower.includes('act as a') ||
    contentLower.includes('your role is') ||
    contentLower.includes('## role') ||
    contentLower.includes('# role')
  ) {
    // Could be a subagent/persona, but only if it's in an ambiguous location
    // Don't override path-based detection for general instruction files
  }

  // 4. Default
  return 'instructions';
}

/**
 * Extract a human-readable name from a file path.
 * "skills/react-architect.md" → "react architect"
 */
function nameFromPath(filePath: string): string {
  const base = path.basename(filePath, path.extname(filePath));
  return base.replace(/[-_]/g, ' ');
}

function asStringArray(val: unknown): string[] | undefined {
  if (Array.isArray(val)) {
    return val.filter((v) => typeof v === 'string');
  }
  return undefined;
}
