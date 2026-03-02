import type { AgentAdapter } from './baseAdapter';
import type { NormalizedContent } from '../types';

/**
 * Adapter for GitHub Copilot (.github/copilot-instructions.md).
 * Format: Markdown with # headings for sections.
 */
export class CopilotAdapter implements AgentAdapter {
  readonly agentId = 'copilot' as const;
  readonly targetPath = '.github/copilot-instructions.md';

  normalize(content: string): NormalizedContent {
    const sections = parseMarkdownSections(content);
    return { sections, rawContent: content };
  }

  format(normalized: NormalizedContent): string {
    // If source already has headings, use markdown format
    if (normalized.sections.some((s) => s.heading)) {
      return normalized.sections
        .map((s) => {
          if (s.heading) {
            return `## ${s.heading}\n\n${s.content}`;
          }
          return s.content;
        })
        .join('\n\n');
    }

    // Flat text → wrap in a single section
    return normalized.rawContent;
  }
}

/**
 * Parse markdown content into sections based on ## headings.
 */
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
      // Save previous section
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

  // Save last section
  if (currentContent.length > 0 || currentHeading) {
    sections.push({
      heading: currentHeading,
      content: currentContent.join('\n').trim(),
    });
  }

  return sections.filter((s) => s.content.length > 0 || s.heading);
}
