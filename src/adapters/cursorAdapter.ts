import type { AgentAdapter } from './baseAdapter';
import type { NormalizedContent } from '../types';

/**
 * Adapter for Cursor (.cursorrules).
 * Format: flat text, sections separated by blank lines.
 */
export class CursorAdapter implements AgentAdapter {
  readonly agentId = 'cursor' as const;
  readonly targetPath = '.cursorrules';

  normalize(content: string): NormalizedContent {
    const sections = parseFlatTextSections(content);
    return { sections, rawContent: content };
  }

  format(normalized: NormalizedContent): string {
    // If converting from a similar flat format, use raw content
    if (normalized.sections.every((s) => !s.heading)) {
      return normalized.rawContent;
    }

    // Convert headed sections to flat text
    return normalized.sections
      .map((s) => {
        if (s.heading) {
          return `${s.heading}\n\n${s.content}`;
        }
        return s.content;
      })
      .join('\n\n');
  }
}

/**
 * Parse flat text into sections split by double newlines or "---" separators.
 */
function parseFlatTextSections(
  content: string
): NormalizedContent['sections'] {
  const blocks = content.split(/\n{2,}---\n{2,}|\n{3,}/);
  return blocks
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => ({ content: block }));
}
