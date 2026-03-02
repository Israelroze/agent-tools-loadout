import type { AgentAdapter } from './baseAdapter';
import type { NormalizedContent } from '../types';

/**
 * Adapter for Claude (CLAUDE.md).
 * Format: Markdown with # headings, similar to Copilot but uses CLAUDE.md.
 */
export class ClaudeAdapter implements AgentAdapter {
  readonly agentId = 'claude' as const;
  readonly targetPath = 'CLAUDE.md';

  normalize(content: string): NormalizedContent {
    const sections = parseMarkdownSections(content);
    return { sections, rawContent: content };
  }

  format(normalized: NormalizedContent): string {
    if (normalized.sections.some((s) => s.heading)) {
      return normalized.sections
        .map((s) => {
          if (s.heading) {
            return `# ${s.heading}\n\n${s.content}`;
          }
          return s.content;
        })
        .join('\n\n');
    }

    return normalized.rawContent;
  }
}

function parseMarkdownSections(
  content: string
): NormalizedContent['sections'] {
  const lines = content.split('\n');
  const sections: NormalizedContent['sections'] = [];
  let currentHeading: string | undefined;
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      if (currentContent.length > 0 || currentHeading) {
        sections.push({
          heading: currentHeading,
          content: currentContent.join('\n').trim(),
        });
      }
      currentHeading = headingMatch[1];
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentContent.length > 0 || currentHeading) {
    sections.push({
      heading: currentHeading,
      content: currentContent.join('\n').trim(),
    });
  }

  return sections.filter((s) => s.content.length > 0 || s.heading);
}
